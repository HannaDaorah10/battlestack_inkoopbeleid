import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadSweep, readCliOptions } from './cli'
import { runPath } from './paths'
import { parseCsv, writeCsv } from './report/csv'
import { resolveRetrieval } from './resolve-retrieval'
import {
    DISAGREEMENT_SPREAD,
    ONVOLDOENDE_MAX,
    findDisagreements,
    isLegacyVerdictFile,
    parseVerdictRow,
    summariseVerdicts,
} from './verdicts'
import type { Disagreement, RankingRow, SleutelRow, Verdict } from './verdicts'

/**
 * Turn the reviewers' grades back into a ranking.
 *
 * The blind labels in `beoordeling.html` are joined against `sleutel.json` here, so the moment of
 * "which model was A?" happens once, after everyone has judged, instead of colouring the judging.
 *
 * Disagreement between reviewers is reported rather than averaged away. Two people far apart on an
 * answer is the most useful signal in the file: it marks the questions where the policy itself is
 * ambiguous, or where the answer is subtly wrong in a way only one of them caught.
 */

async function main(): Promise<void> {
    const options = readCliOptions()
    const sweep = await loadSweep(options.config)

    // Same resolution as `eval:generate`, so aggregating without --retrieval reads back the
    // reviews for the phase-1 winner, and --retrieval <id> reads back a specific other run.
    const retrieval = await resolveRetrieval(sweep.name, options.retrieval)
    const outDir = runPath(sweep.name, 'generatie', retrieval.configId)
    const reviewDir = join(outDir, 'beoordelingen')

    const sleutel = await readSleutel(join(outDir, 'sleutel.json'))
    const verdicts = await readVerdicts(reviewDir)

    if (verdicts.length === 0) {
        throw new Error(
            `Geen beoordelingen gevonden in ${reviewDir}.\n`
            + 'Zet de CSV-bestanden die je collega\'s hebben teruggestuurd in die map.',
        )
    }

    const reviewers = [...new Set(verdicts.map((v) => v.beoordelaar))].sort()
    console.log(`${verdicts.length} oordelen van ${reviewers.length} beoordelaar(s): ${reviewers.join(', ')}`)

    const rows = summariseVerdicts(sleutel, verdicts)
    const disagreements = findDisagreements(verdicts)

    await writeCsv(join(outDir, 'ranglijst.csv'), rows, [
        'label', 'configId', 'model', 'temperature', 'topP', 'systemPrompt', 'beoordeeld',
        'gemiddeldCijfer', 'gecorrigeerdCijfer', 'onvoldoendes', 'feitfouten', 'percentageFeitfout',
    ])

    await writeMarkdown(join(outDir, 'ranglijst.md'), sweep.name, reviewers, rows, disagreements, verdicts)

    console.log(`\nKlaar. ${join(outDir, 'ranglijst.md')}`)
    const best = rows[0]
    if (best && best.beoordeeld > 0) {
        console.log(`Beste configuratie: ${best.label} = ${best.model} (temp ${best.temperature}, ${best.systemPrompt})`)
        console.log(`  gemiddeld een ${formatGrade(best.gemiddeldCijfer)}, ${best.feitfouten} feitelijke fout(en) op ${best.beoordeeld} antwoorden`)
    }
    if (disagreements.length > 0) {
        console.log(`${disagreements.length} antwoord(en) waarover beoordelaars het oneens waren - zie ranglijst.md`)
    }
}

async function readSleutel(file: string): Promise<SleutelRow[]> {
    try {
        return JSON.parse(await readFile(file, 'utf8')) as SleutelRow[]
    } catch {
        throw new Error(`Geen sleutel op ${file}. Draai eerst: pnpm eval:generate`)
    }
}

async function readVerdicts(dir: string): Promise<Verdict[]> {
    let files: string[]
    try {
        files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.csv'))
    } catch {
        await mkdir(dir, { recursive: true })
        return []
    }

    const out: Verdict[] = []
    for (const file of files) {
        const rows = parseCsv(await readFile(join(dir, file), 'utf8'))
        if (isLegacyVerdictFile(rows)) {
            console.warn(
                `LET OP: ${file} komt van de oude beoordelingspagina (goed/twijfel/fout) en wordt `
                + 'overgeslagen. Vraag die beoordelaar de nieuwe beoordeling.html in te vullen.',
            )
            continue
        }
        const fallbackName = file.replace(/\.csv$/i, '')
        for (const row of rows) {
            const verdict = parseVerdictRow(row, fallbackName)
            if (verdict) out.push(verdict)
        }
    }

    return out
}

async function writeMarkdown(
    file: string,
    sweepName: string,
    reviewers: readonly string[],
    rows: readonly RankingRow[],
    disagreements: readonly Disagreement[],
    verdicts: readonly Verdict[],
): Promise<void> {
    const lines = [
        `# Beoordeling "${sweepName}"`,
        '',
        `${verdicts.length} oordelen van ${reviewers.length} beoordelaar(s): ${reviewers.join(', ')}.`,
        '',
        '## Ranglijst',
        '',
        'Gesorteerd op het kleinste aandeel antwoorden met een feitelijke fout, daarna op het',
        'gecorrigeerde cijfer. In dit domein weegt een stellig fout bedrag zwaarder dan een minder',
        'mooi geformuleerd antwoord, dus "weinig fouten" gaat voor "hoog cijfer".',
        '',
        '- **gem.** - het gemiddelde cijfer (1-10) dat de beoordelaars gaven.',
        '- **gecorr.** - hetzelfde, maar gecorrigeerd voor hoe streng elke beoordelaar gemiddeld is.',
        '  Bij een enkele beoordelaar is dit gelijk aan het gewone gemiddelde.',
        `- **onvold.** - aantal antwoorden met een ${ONVOLDOENDE_MAX} of lager.`,
        '- **feitfout** - aantal antwoorden waarbij "bevat een feitelijke fout" is aangevinkt.',
        '',
        '| # | label | model | temp | prompt | beoordeeld | gem. | gecorr. | onvold. | feitfout | % feitfout |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        ...rows.map((row, i) => `| ${i + 1} | ${row.label} | ${row.model} | ${decimal(row.temperature)} `
            + `| ${row.systemPrompt} | ${row.beoordeeld} | ${formatGrade(row.gemiddeldCijfer)} `
            + `| ${formatGrade(row.gecorrigeerdCijfer)} | ${row.onvoldoendes} | ${row.feitfouten} `
            + `| ${decimal(row.percentageFeitfout)}% |`),
        '',
        '## Waar beoordelaars het oneens waren',
        '',
    ]

    if (disagreements.length > 0) {
        lines.push(
            `Antwoorden waar de cijfers ${DISAGREEMENT_SPREAD} punten of meer uiteenliepen, of waar de een`,
            'wel en de ander geen feitelijke fout zag. Of het beleid is hier zelf onduidelijk, of het',
            'antwoord is subtiel fout op een manier die maar een van beiden opviel.',
            '',
        )
        for (const item of disagreements) {
            lines.push(`### Vraag ${item.caseId}, configuratie ${item.label}`, '')
            for (const oordeel of item.oordelen) {
                const grade = oordeel.cijfer === null ? 'geen cijfer' : `een ${oordeel.cijfer}`
                const error = oordeel.feitfout ? ', feitelijke fout' : ''
                const note = oordeel.opmerking ? ` - "${oordeel.opmerking}"` : ''
                lines.push(`- **${oordeel.beoordelaar}**: ${grade}${error}${note}`)
            }
            lines.push('')
        }
    } else {
        lines.push(reviewers.length > 1 ? 'Nergens.' : 'Er is maar een beoordelaar, dus niets te vergelijken.', '')
    }

    const comments = verdicts.filter((v) => v.opmerking.trim().length > 0)
    if (comments.length > 0) {
        lines.push(
            '## Alle toelichtingen',
            '',
            '| vraag | configuratie | cijfer | feitfout | beoordelaar | toelichting |',
            '|---|---|---|---|---|---|',
        )
        for (const comment of comments) {
            lines.push(`| ${comment.caseId} | ${comment.label} | ${comment.cijfer ?? '-'} `
                + `| ${comment.feitfout ? 'ja' : ''} | ${comment.beoordelaar} `
                + `| ${comment.opmerking.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} |`)
        }
    }

    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, `${lines.join('\n')}\n`, 'utf8')
}

function formatGrade(value: number | null): string {
    return value === null ? '-' : decimal(value)
}

function decimal(value: number): string {
    return String(value).replace('.', ',')
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
})
