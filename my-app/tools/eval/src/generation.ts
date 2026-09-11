import { readFile, writeFile } from 'node:fs/promises'
import {
    buildAdvicePrompt,
    formatContextBlock,
} from '../../../server/utils/inkoopbeleid/advice-prompt'
import { checkAnswer } from './checks'
import { loadCases, loadSweep, readCliOptions } from './cli'
import { documentsFor, loadCorpus } from './corpus'
import { assertGatewayReady, loadEnv } from './env'
import { expandGeneration, indexKey } from './expand'
import { buildStores, corpusFingerprint, embedQuestions, storeFor } from './index-build'
import { generateAnswer } from './gateway'
import { evalPath, runPath } from './paths'
import { runPool } from './pool'
import { resolveRetrieval } from './resolve-retrieval'
import { cellKey, completedCells, createJsonlWriter, readJsonl } from './store'
import { blindLabel, buildReviewPage } from './report/html'
import { writeCsv } from './report/csv'
import { writeGenerationSummary } from './report/markdown'
import type { GenerationSummaryRow } from './report/markdown'
import type { EvalCase, GenerationConfig, GenerationRun } from './types'

/**
 * Phase 2: how do different models, temperatures and system prompts answer the same questions?
 *
 * Retrieval is fixed to one configuration chosen in phase 1, so the context each question gets is
 * identical across the sweep and every difference in the answers is attributable to the generation
 * settings. It also means the retrieval work happens once instead of once per cell.
 *
 * Nothing here scores quality. The output is a review package; the verdict is a person's.
 */

interface Cell {
    config: GenerationConfig
    evalCase: EvalCase
    sampleIndex: number
}

interface CaseContext {
    contextBlock: string
    sources: string[]
    corpusText: string
    knownSources: string[]
    grounded: boolean
}

async function main(): Promise<void> {
    const options = readCliOptions()
    loadEnv()

    const sweep = await loadSweep(options.config)
    if (!sweep.generation) {
        throw new Error(`${options.config} heeft geen "generation"-blok; voeg dat toe om fase 2 te draaien.`)
    }

    const cases = await loadCases(sweep.questions, options.limit)
    const configs = expandGeneration(sweep.generation)
    const samples = sweep.generation.samples
    const totalCalls = configs.length * cases.length * samples

    console.log(`Sweep "${sweep.name}" - fase 2 (generatie)`)
    console.log(`  ${configs.length} configuraties x ${cases.length} vragen x ${samples} trekking(en) = ${totalCalls} aanroepen`)

    if (totalCalls > sweep.maxCalls) {
        console.warn(`  LET OP: dat is meer dan maxCalls (${sweep.maxCalls}); de run stopt daar.`)
    }

    if (options.dryRun) {
        // Deliberately before resolving the retrieval configuration. A dry run exists to answer
        // "what will this cost?" before anything has been spent, so it has to work on a sweep
        // where phase 1 has not run yet - which is exactly when the question gets asked.
        console.log('\n--dry-run: er is niets aangeroepen en niets betaald.\n')
        configs.forEach((config, i) => {
            console.log(
                `  ${blindLabel(i)}  ${config.configId}  ${config.model}  temp=${config.temperature}`
                + `  topP=${config.topP}  max=${config.maxOutputTokens}  prompt=${config.systemPrompt}`,
            )
        })

        const chosen = await resolveRetrieval(sweep.name, options.retrieval).catch(() => null)
        console.log(chosen
            ? `\nRetrieval zou worden vastgezet op ${chosen.configId}.`
            : '\nFase 1 is nog niet gedraaid, dus de retrieval-configuratie ligt nog niet vast.'
                + '\nDraai eerst: pnpm eval:retrieval')
        return
    }

    const retrieval = await resolveRetrieval(sweep.name, options.retrieval)
    console.log(`  retrieval vastgezet op ${retrieval.configId} (${retrieval.embeddingModel}, chunk ${retrieval.maxChunkSize}, overlap ${retrieval.chunkOverlap}, topK ${retrieval.topK})`)

    assertGatewayReady()

    const prompts = await loadPrompts(configs)
    const documents = await loadCorpus(sweep.corpus)
    const fingerprint = corpusFingerprint(documents)
    const stores = await buildStores(sweep.name, indexKey(retrieval), retrieval, documents, fingerprint, console.log)
    const vectors = await embedQuestions(sweep.name, retrieval.embeddingModel, cases)

    // Context is built once per question rather than once per cell: it is identical for every
    // generation configuration by construction, and rebuilding it would make the comparison
    // depend on retrieval noise the sweep is not trying to measure.
    const contexts = new Map<string, CaseContext>()
    for (const evalCase of cases) {
        const scoped = documentsFor(documents, evalCase.organisatie)
        const hits = storeFor(stores, evalCase.organisatie).query(vectors.get(evalCase.id)!, retrieval.topK)
        const sources = hits.map((h) => ({
            title: h.chunk.title,
            source: h.chunk.source,
            score: h.score,
            text: h.chunk.text,
        }))

        contexts.set(evalCase.id, {
            contextBlock: formatContextBlock(sources),
            sources: [...new Set(sources.map((s) => s.source))],
            corpusText: scoped.map((d) => d.text).join('\n'),
            knownSources: scoped.map((d) => d.source),
            grounded: sources.length > 0,
        })
    }

    // Namespaced by retrieval configuration, not shared across them: two runs of `eval:generate`
    // against different retrieval configs must never collide on the same runs.jsonl, or the second
    // run's resume check would see the first run's cells and (wrongly) call itself already done -
    // it would also silently report the first run's answers as if they came from the second config.
    const outDir = runPath(sweep.name, 'generatie', retrieval.configId)
    const runsFile = `${outDir}/runs.jsonl`
    const done = completedCells(await readJsonl<GenerationRun>(runsFile))
    if (done.size > 0) console.log(`${done.size} antwoorden stonden er al; die worden overgeslagen.`)

    const pending: Cell[] = []
    for (const config of configs) {
        for (const evalCase of cases) {
            for (let sampleIndex = 0; sampleIndex < samples; sampleIndex++) {
                if (done.has(cellKey(config.configId, evalCase.id, sampleIndex))) continue
                pending.push({ config, evalCase, sampleIndex })
            }
        }
    }

    const budgeted = pending.slice(0, sweep.maxCalls)
    if (budgeted.length < pending.length) {
        console.warn(`Alleen de eerste ${budgeted.length} van ${pending.length} aanroepen worden gedaan (maxCalls).`)
    }

    const writer = await createJsonlWriter(runsFile)
    let finished = 0

    console.log(`\n${budgeted.length} aanroepen te gaan, ${sweep.concurrency} tegelijk...`)

    await runPool(budgeted, sweep.concurrency, async (cell) => {
        const context = contexts.get(cell.evalCase.id)!
        const run = await runCell(cell, context, prompts)
        await writer.append(run)

        finished++
        if (finished % 10 === 0 || finished === budgeted.length) {
            console.log(`  ${finished}/${budgeted.length}`)
        }
    })

    const runs = await readJsonl<GenerationRun>(runsFile)
    await writeReports(sweep.name, outDir, retrieval.configId, configs, cases, runs, contexts)

    console.log(`\nKlaar. Resultaten in ${outDir}`)
    console.log('  beoordeling.html - stuur dit naar je collega\'s')
    console.log('  sleutel.csv      - welke letter bij welke configuratie hoort (houd dit zelf)')
    console.log('  samenvatting.md  - objectieve signalen per configuratie')
    console.log('  resultaten.csv   - een regel per antwoord')
    console.log('  runs.jsonl       - ruwe antwoorden met tokens en duur')
}

async function runCell(
    cell: Cell,
    context: CaseContext,
    prompts: Map<string, string>,
): Promise<GenerationRun> {
    const started = Date.now()
    const prompt = buildAdvicePrompt({
        contextBlock: context.contextBlock,
        question: cell.evalCase.vraag,
    })

    try {
        const result = await generateAnswer({
            model: cell.config.model,
            system: prompts.get(cell.config.systemPrompt)!,
            prompt,
            temperature: cell.config.temperature,
            topP: cell.config.topP,
            maxOutputTokens: cell.config.maxOutputTokens,
        })

        return {
            configId: cell.config.configId,
            caseId: cell.evalCase.id,
            sampleIndex: cell.sampleIndex,
            answer: result.text,
            error: null,
            finishReason: result.finishReason,
            promptTokens: result.inputTokens,
            completionTokens: result.outputTokens,
            durationMs: Date.now() - started,
            grounded: context.grounded,
            sources: context.sources,
            flags: checkAnswer({
                answer: result.text,
                question: cell.evalCase.vraag,
                corpusText: context.corpusText,
                knownSources: context.knownSources,
                grounded: context.grounded,
                finishReason: result.finishReason,
            }),
        }
    } catch (err) {
        // A failed cell is recorded, not thrown: one model refusing a parameter should not end a
        // run that has already paid for hundreds of answers, and the failure itself is a finding.
        return {
            configId: cell.config.configId,
            caseId: cell.evalCase.id,
            sampleIndex: cell.sampleIndex,
            answer: '',
            error: err instanceof Error ? err.message : String(err),
            finishReason: null,
            promptTokens: null,
            completionTokens: null,
            durationMs: Date.now() - started,
            grounded: context.grounded,
            sources: context.sources,
            flags: [],
        }
    }
}

async function loadPrompts(configs: readonly GenerationConfig[]): Promise<Map<string, string>> {
    const prompts = new Map<string, string>()

    for (const path of new Set(configs.map((c) => c.systemPrompt))) {
        try {
            prompts.set(path, (await readFile(evalPath(path), 'utf8')).trim())
        } catch {
            throw new Error(`Systeemprompt ${path} niet gevonden (verwacht op ${evalPath(path)}).`)
        }
    }

    return prompts
}

async function writeReports(
    sweepName: string,
    outDir: string,
    retrievalConfigId: string,
    configs: readonly GenerationConfig[],
    cases: readonly EvalCase[],
    runs: readonly GenerationRun[],
    contexts: ReadonlyMap<string, CaseContext>,
): Promise<void> {
    const labels = new Map(configs.map((c, i) => [c.configId, blindLabel(i)]))

    const sleutel = configs.map((c) => ({
        label: labels.get(c.configId)!,
        configId: c.configId,
        model: c.model,
        temperature: c.temperature,
        topP: c.topP,
        maxOutputTokens: c.maxOutputTokens,
        systemPrompt: c.systemPrompt,
    }))

    await writeCsv(`${outDir}/sleutel.csv`, sleutel, [
        'label', 'configId', 'model', 'temperature', 'topP', 'maxOutputTokens', 'systemPrompt',
    ])
    // The same mapping as JSON, for `eval:aggregate` to read back. Parsing our own CSV would mean
    // re-implementing its quoting and locale rules in the reader, for no gain.
    await writeFile(`${outDir}/sleutel.json`, JSON.stringify(sleutel, null, 2), 'utf8')

    await writeCsv(`${outDir}/resultaten.csv`, runs.map((run) => ({
        label: labels.get(run.configId) ?? '?',
        configId: run.configId,
        caseId: run.caseId,
        trekking: run.sampleIndex,
        vraag: cases.find((c) => c.id === run.caseId)?.vraag ?? '',
        antwoord: run.answer,
        fout: run.error ?? '',
        vlaggen: run.flags.join(' '),
        gegrond: run.grounded ? 'ja' : 'nee',
        bronnen: run.sources.join(' | '),
        lengte: run.answer.length,
        duurMs: run.durationMs,
        invoerTokens: run.promptTokens ?? '',
        uitvoerTokens: run.completionTokens ?? '',
    })), [
        'label', 'configId', 'caseId', 'trekking', 'vraag', 'antwoord', 'fout', 'vlaggen',
        'gegrond', 'bronnen', 'lengte', 'duurMs', 'invoerTokens', 'uitvoerTokens',
    ])

    const summary: GenerationSummaryRow[] = configs.map((config) => {
        const own = runs.filter((r) => r.configId === config.configId)
        const ok = own.filter((r) => r.error === null)
        const vlaggen: Record<string, number> = {}
        for (const run of own) {
            for (const flag of run.flags) vlaggen[flag] = (vlaggen[flag] ?? 0) + 1
        }

        return {
            label: labels.get(config.configId)!,
            configId: config.configId,
            model: config.model,
            temperature: config.temperature,
            topP: config.topP,
            maxOutputTokens: config.maxOutputTokens,
            systemPrompt: config.systemPrompt,
            antwoorden: ok.length,
            fouten: own.length - ok.length,
            gemiddeldeLengte: ok.length > 0 ? ok.reduce((a, r) => a + r.answer.length, 0) / ok.length : 0,
            gemiddeldeDuurMs: ok.length > 0 ? ok.reduce((a, r) => a + r.durationMs, 0) / ok.length : 0,
            invoerTokens: own.reduce((a, r) => a + (r.promptTokens ?? 0), 0),
            uitvoerTokens: own.reduce((a, r) => a + (r.completionTokens ?? 0), 0),
            vlaggen,
        }
    })

    await writeGenerationSummary(`${outDir}/samenvatting.md`, sweepName, retrievalConfigId, summary, cases.length)

    await buildReviewPage(`${outDir}/beoordeling.html`, {
        sweepName,
        retrievalConfigId,
        cases: cases.map((c) => ({
            id: c.id,
            vraag: c.vraag,
            organisatie: c.organisatie,
            fragmenten: contexts.get(c.id)?.sources ?? [],
        })),
        answers: runs.map((run) => ({
            label: labels.get(run.configId) ?? '?',
            caseId: run.caseId,
            sampleIndex: run.sampleIndex,
            answer: run.answer,
            error: run.error,
            flags: run.flags,
        })),
    })
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
})
