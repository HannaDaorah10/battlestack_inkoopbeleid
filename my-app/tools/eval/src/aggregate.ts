import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadSweep, readCliOptions } from './cli'
import { runPath } from './paths'
import { parseCsv, writeCsv } from './report/csv'
import { resolveRetrieval } from './resolve-retrieval'

/**
 * Turn the reviewers' verdicts back into a ranking.
 *
 * The blind labels in `beoordeling.html` are joined against `sleutel.json` here, so the moment of
 * "which model was A?" happens once, after everyone has judged, instead of colouring the judging.
 *
 * Disagreement between reviewers is reported rather than averaged away. Two people splitting on an
 * answer is the most useful signal in the file: it marks the questions where the policy itself is
 * ambiguous, or where the answer is subtly wrong in a way only one of them caught.
 */

interface SleutelRow {
    label: string
    configId: string
    model: string
    temperature: number
    topP: number
    maxOutputTokens: number
    systemPrompt: string
}

interface Verdict {
    beoordelaar: string
    caseId: string
    label: string
    trekking: string
    oordeel: string
    opmerking: string
}

const VERDICTS = ['goed', 'twijfel', 'fout'] as const

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

    const rows = sleutel.map((config) => {
        const own = verdicts.filter((v) => v.label === config.label)
        const counts = Object.fromEntries(
            VERDICTS.map((v) => [v, own.filter((o) => o.oordeel === v).length]),
        ) as Record<(typeof VERDICTS)[number], number>

        const total = counts.goed + counts.twijfel + counts.fout

        return {
            label: config.label,
            configId: config.configId,
            model: config.model,
            temperature: config.temperature,
            topP: config.topP,
            systemPrompt: config.systemPrompt,
            beoordeeld: total,
            goed: counts.goed,
            twijfel: counts.twijfel,
            fout: counts.fout,
            percentageGoed: total > 0 ? Math.round((counts.goed / total) * 1000) / 10 : 0,
            percentageFout: total > 0 ? Math.round((counts.fout / total) * 1000) / 10 : 0,
        }
    })

    // Fewest wrong answers first, then most right. In this domain a confidently wrong threshold
    // costs more than a missing one, so a configuration that errs less wins over one that dazzles
    // more often - which sorting on "goed" alone would get backwards.
    rows.sort((a, b) => (a.percentageFout - b.percentageFout) || (b.percentageGoed - a.percentageGoed))

    const disagreements = findDisagreements(verdicts)

    await writeCsv(join(outDir, 'ranglijst.csv'), rows, [
        'label', 'configId', 'model', 'temperature', 'topP', 'systemPrompt',
        'beoordeeld', 'goed', 'twijfel', 'fout', 'percentageGoed', 'percentageFout',
    ])

    await writeMarkdown(join(outDir, 'ranglijst.md'), sweep.name, reviewers, rows, disagreements, verdicts)

    console.log(`\nKlaar. ${join(outDir, 'ranglijst.md')}`)
    if (rows[0]) {
        console.log(`Beste configuratie: ${rows[0].label} = ${rows[0].model} (temp ${rows[0].temperature}, ${rows[0].systemPrompt})`)
        console.log(`  ${rows[0].percentageGoed}% goed, ${rows[0].percentageFout}% fout`)
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
        const raw = await readFile(join(dir, file), 'utf8')
        for (const row of parseCsv(raw)) {
            out.push({
                beoordelaar: row.beoordelaar ?? file.replace(/\.csv$/i, ''),
                caseId: row.caseId ?? '',
                label: row.label ?? '',
                trekking: row.trekking ?? '0',
                oordeel: (row.oordeel ?? '').toLowerCase(),
                opmerking: row.opmerking ?? '',
            })
        }
    }

    return out.filter((v) => v.label.length > 0)
}

interface Disagreement {
    caseId: string
    label: string
    oordelen: Array<{ beoordelaar: string, oordeel: string, opmerking: string }>
}

function findDisagreements(verdicts: readonly Verdict[]): Disagreement[] {
    const groups = new Map<string, Verdict[]>()
    for (const verdict of verdicts) {
        if (!verdict.oordeel) continue
        const key = `${verdict.caseId}|${verdict.label}|${verdict.trekking}`
        const bucket = groups.get(key) ?? []
        bucket.push(verdict)
        groups.set(key, bucket)
    }

    const out: Disagreement[] = []
    for (const bucket of groups.values()) {
        if (bucket.length < 2) continue
        if (new Set(bucket.map((v) => v.oordeel)).size < 2) continue
        out.push({
            caseId: bucket[0]!.caseId,
            label: bucket[0]!.label,
            oordelen: bucket.map((v) => ({
                beoordelaar: v.beoordelaar,
                oordeel: v.oordeel,
                opmerking: v.opmerking,
            })),
        })
    }

    return out
}

async function writeMarkdown(
    file: string,
    sweepName: string,
    reviewers: readonly string[],
    rows: ReadonlyArray<Record<string, string | number>>,
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
        'Gesorteerd op minste fouten, daarna op meeste goed. In dit domein weegt een stellig fout',
        'bedrag zwaarder dan een ontbrekend antwoord, dus "weinig fout" gaat voor "vaak goed".',
        '',
        '| # | label | model | temp | prompt | goed | twijfel | fout | % goed | % fout |',
        '|---|---|---|---|---|---|---|---|---|---|',
        ...rows.map((row, i) => `| ${i + 1} | ${row.label} | ${row.model} | ${String(row.temperature).replace('.', ',')} `
            + `| ${row.systemPrompt} | ${row.goed} | ${row.twijfel} | ${row.fout} `
            + `| ${String(row.percentageGoed).replace('.', ',')}% | ${String(row.percentageFout).replace('.', ',')}% |`),
        '',
    ]

    if (disagreements.length > 0) {
        lines.push(
            '## Waar beoordelaars het oneens waren',
            '',
            'Deze antwoorden verdienen aandacht: of het beleid is hier zelf onduidelijk, of het',
            'antwoord is subtiel fout op een manier die maar een van beiden opviel.',
            '',
        )
        for (const item of disagreements) {
            lines.push(`### Vraag ${item.caseId}, configuratie ${item.label}`, '')
            for (const oordeel of item.oordelen) {
                const note = oordeel.opmerking ? ` - "${oordeel.opmerking}"` : ''
                lines.push(`- **${oordeel.beoordelaar}**: ${oordeel.oordeel}${note}`)
            }
            lines.push('')
        }
    } else {
        lines.push('## Waar beoordelaars het oneens waren', '', 'Nergens.', '')
    }

    const comments = verdicts.filter((v) => v.opmerking.trim().length > 0)
    if (comments.length > 0) {
        lines.push('## Alle toelichtingen', '', '| vraag | configuratie | oordeel | beoordelaar | toelichting |', '|---|---|---|---|---|')
        for (const comment of comments) {
            lines.push(`| ${comment.caseId} | ${comment.label} | ${comment.oordeel} | ${comment.beoordelaar} | ${comment.opmerking.replace(/\|/g, '\\|')} |`)
        }
    }

    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, `${lines.join('\n')}\n`, 'utf8')
}

main().catch((err: unknown) => {
    console.error(`\n${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
})
