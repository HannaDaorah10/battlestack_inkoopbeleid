import { mkdir, writeFile } from 'node:fs/promises'
import { loadCases, loadSweep, readCliOptions } from './cli'
import { loadCorpus, organisationsIn } from './corpus'
import { assertGatewayReady, loadEnv } from './env'
import { expandRetrieval, groupByIndex } from './expand'
import { ALL_ORGANISATIONS, buildStores, corpusFingerprint, embedQuestions, storeFor } from './index-build'
import { runPath } from './paths'
import { errorRun, scoreRun, summarise } from './scoring'
import { cellKey, completedCells, createJsonlWriter, readJsonl } from './store'
import { writeCsv } from './report/csv'
import { writeRetrievalSummary } from './report/markdown'
import type { JsonlWriter } from './store'
import type { MemoryVectorStore } from './vector-store'
import type { EvalCase, RetrievalConfig, RetrievalRun } from './types'

/**
 * Phase 1: which retrieval settings actually find the right passage?
 *
 * This runs before any chat model is touched, because retrieval sets the ceiling on everything
 * after it. If the fragment holding the answer is never fetched, no model can answer from it - it
 * can only guess convincingly. Scoring needs no language model and no human judgement here: a
 * fragment either contains the expected amount or it does not.
 */

async function main(): Promise<void> {
    const options = readCliOptions()
    loadEnv()

    const sweep = await loadSweep(options.config)
    const cases = await loadCases(sweep.questions, options.limit)
    const configs = expandRetrieval(sweep.retrieval)
    const groups = groupByIndex(configs)

    console.log(`Sweep "${sweep.name}" - fase 1 (retrieval)`)
    console.log(`  ${configs.length} configuraties x ${cases.length} vragen = ${configs.length * cases.length} metingen`)
    console.log(`  ${groups.size} indexen te bouwen; configuraties die alleen in topK verschillen delen er een`)
    console.log(`  ${sweep.retrieval.embeddingModel.length} x ${cases.length} vraag-embeddings`)
    console.log('  0 aanroepen naar een chatmodel - deze fase gebruikt alleen embeddings')

    if (options.dryRun) {
        console.log('\n--dry-run: er is niets aangeroepen en niets betaald.\n')
        for (const config of configs) {
            console.log(
                `  ${config.configId}  ${config.embeddingModel}  chunk=${config.maxChunkSize}`
                + `  overlap=${config.chunkOverlap}  topK=${config.topK}`,
            )
        }
        return
    }

    assertGatewayReady()

    const documents = await loadCorpus(sweep.corpus)
    const known = organisationsIn(documents)
    console.log(`\n${documents.length} document(en): ${documents.map((d) => `${d.title} (${d.organisatie})`).join(', ')}`)

    for (const organisatie of new Set(cases.map((c) => c.organisatie))) {
        if (!known.has(organisatie)) {
            console.warn(
                `  LET OP: geen document met organisatie "${organisatie}". Die vragen doorzoeken nu`
                + ' het hele corpus, wat makkelijker is dan wat de app doet.',
            )
        }
    }

    const unscored = cases.filter((c) => c.verwachteTrefwoorden.length === 0)
    if (unscored.length > 0) {
        console.warn(`  ${unscored.length} vraag/vragen zonder verwachteTrefwoorden tellen niet mee in recall en mrr.`)
    }

    const outDir = runPath(sweep.name, 'retrieval')
    const runsFile = `${outDir}/runs.jsonl`
    const done = completedCells(await readJsonl<RetrievalRun>(runsFile))
    if (done.size > 0) console.log(`\n${done.size} metingen stonden er al; die worden overgeslagen.`)

    const writer = await createJsonlWriter(runsFile)
    const fingerprint = corpusFingerprint(documents)

    // Question vectors depend only on the embedding model, never on chunk size or topK, so they
    // are computed once per model instead of once per configuration. On the example grid that is
    // 60 calls where the naive loop makes 720.
    //
    // A model that fails here is recorded, not thrown: one broken embedding model should not undo
    // every group that uses a different, working one. Every configuration built on it is written
    // below as an error row instead of being attempted, so the run's exit code and the rest of its
    // groups are unaffected.
    const questionVectors = new Map<string, Map<string, number[]>>()
    const brokenModels = new Map<string, string>()
    for (const model of sweep.retrieval.embeddingModel) {
        try {
            questionVectors.set(model, await embedQuestions(sweep.name, model, cases))
            console.log(`Vraag-embeddings klaar voor ${model}`)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            brokenModels.set(model, message)
            console.warn(`\nLET OP: embeddingmodel "${model}" faalt: ${message}`)
            console.warn('Elke configuratie met dit model krijgt een foutregel; de rest van de run gaat door.\n')
        }
    }

    for (const [key, bucket] of groups) {
        const shape = bucket[0]!
        const brokenReason = brokenModels.get(shape.embeddingModel)

        let stores: Map<string, MemoryVectorStore>
        if (!brokenReason) {
            try {
                stores = await buildStores(sweep.name, key, shape, documents, fingerprint, console.log)
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err)
                console.warn(`\nLET OP: index ${key} bouwen mislukt: ${message}`)
                console.warn('Elke configuratie in deze groep krijgt een foutregel; de rest van de run gaat door.\n')
                await writeErrorRuns(writer, done, bucket, cases, message)
                continue
            }
        } else {
            await writeErrorRuns(writer, done, bucket, cases, brokenReason)
            console.log(`Index ${key} overgeslagen (embeddingmodel faalt).`)
            continue
        }

        const maxTopK = Math.max(...bucket.map((c) => c.topK))
        const vectors = questionVectors.get(shape.embeddingModel)!

        for (const evalCase of cases) {
            const started = Date.now()
            // One query serves every topK in the bucket: the ranking is identical and only the
            // cut-off differs, so slicing is exactly equivalent to querying again with a smaller K.
            const hits = storeFor(stores, evalCase.organisatie).query(vectors.get(evalCase.id)!, maxTopK)
            const durationMs = Date.now() - started

            for (const config of bucket) {
                if (done.has(cellKey(config.configId, evalCase.id))) continue
                await writer.append(scoreRun(config, evalCase, hits, durationMs))
            }
        }

        console.log(`Index ${key} klaar (${bucket.length} configuratie(s), ${stores.get(ALL_ORGANISATIONS)!.size} chunks)`)
    }

    const runs = await readJsonl<RetrievalRun>(runsFile)
    const rows = summarise(configs, runs)

    await writeCsv(`${outDir}/resultaten.csv`, rows, [
        'configId', 'embeddingModel', 'maxChunkSize', 'chunkOverlap', 'topK',
        'beoordeeldeVragen', 'gevonden', 'recall@k', 'mrr', 'gemiddeldeTopScore', 'fouten',
    ])
    // Phase 2 reads this to resolve `--retrieval`, and to pick a default when none is given.
    // Re-parsing the CSV would mean re-implementing its locale quirks in the reader.
    await mkdir(outDir, { recursive: true })
    await writeFile(`${outDir}/ranglijst.json`, JSON.stringify({ configs, rows }, null, 2), 'utf8')
    await writeRetrievalSummary(`${outDir}/samenvatting.md`, sweep.name, rows, cases.length)

    console.log(`\nKlaar. Resultaten in ${outDir}`)
    console.log('  samenvatting.md  - ranglijst met uitleg, winnaar bovenaan')
    console.log('  resultaten.csv   - een regel per configuratie')
    console.log('  runs.jsonl       - de opgehaalde fragmenten per vraag')
    if (rows[0] && rows[0].fouten === 0) {
        console.log(`\nBeste configuratie: ${rows[0].configId} (recall@k ${rows[0]['recall@k']})`)
        console.log(`Volgende stap: pnpm eval:generate -- --retrieval ${rows[0].configId}`)
    } else if (rows[0]) {
        console.warn('\nGeen enkele configuratie kon worden gemeten - elk embeddingmodel in de sweep faalde.')
        console.warn('Zie de LET OP-regels hierboven en de foutkolom in samenvatting.md.')
    }
}

async function writeErrorRuns(
    writer: JsonlWriter,
    done: ReadonlySet<string>,
    bucket: readonly RetrievalConfig[],
    cases: readonly EvalCase[],
    message: string,
): Promise<void> {
    for (const evalCase of cases) {
        for (const config of bucket) {
            if (done.has(cellKey(config.configId, evalCase.id))) continue
            await writer.append(errorRun(config, evalCase, message))
        }
    }
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
})
