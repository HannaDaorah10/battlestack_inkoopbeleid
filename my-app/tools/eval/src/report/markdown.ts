import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { FLAG_LABELS } from '../checks'

/**
 * The Markdown side of a run: a ranking you can paste into a mail or a ticket.
 *
 * Written for someone who did not run the sweep, so each table is preceded by what its numbers
 * mean in plain Dutch. A leaderboard nobody can interpret is a leaderboard nobody acts on.
 */

export interface RetrievalSummaryRow {
    'configId': string
    'embeddingModel': string
    'maxChunkSize': number
    'chunkOverlap': number
    'topK': number
    'beoordeeldeVragen': number
    'gevonden': number
    'recall@k': number
    'mrr': number
    'gemiddeldeTopScore': number
    /** Vragen die niet konden worden gemeten omdat het embeddingmodel of de index faalde. */
    'fouten': number
}

export async function writeRetrievalSummary(
    file: string,
    sweepName: string,
    rows: readonly RetrievalSummaryRow[],
    totalCases: number,
): Promise<void> {
    const winner = rows.find((row) => row.fouten === 0)
    const failed = rows.filter((row) => row.fouten > 0)
    const skipped = totalCases - (winner?.beoordeeldeVragen ?? 0)

    const lines = [
        `# Retrieval-sweep "${sweepName}"`,
        '',
        `Gedraaid op ${new Date().toLocaleString('nl-NL')}. ${rows.length} configuraties, `
        + `${winner?.beoordeeldeVragen ?? 0} van de ${totalCases} vragen konden automatisch worden beoordeeld.`,
        '',
        '## Wat de kolommen betekenen',
        '',
        '- **recall@k** — bij hoeveel procent van de vragen zat het juiste antwoord in de opgehaalde',
        '  fragmenten. Dit is het belangrijkste getal: wat hier niet wordt gevonden, kan geen enkel',
        '  taalmodel daarna nog goed beantwoorden.',
        '- **mrr** — hoe hoog in de lijst het juiste fragment stond. 1,0 betekent altijd bovenaan,',
        '  0,5 betekent gemiddeld op plek twee. Bij gelijke recall is een hogere mrr beter, want dan',
        '  staat het juiste fragment vooraan in de context die het model krijgt.',
        '- **gemiddeldeTopScore** — hoe sterk de beste match leek volgens het embeddingmodel. Alleen',
        '  vergelijkbaar binnen hetzelfde embeddingmodel, niet ertussen.',
        '- **fouten** — vragen die niet konden worden gemeten omdat het embeddingmodel of de index',
        '  van deze configuratie faalde. Telt niet mee in recall@k/mrr: een model dat nooit is',
        '  aangeroepen heeft het fragment niet gemist, het is er nooit naar gevraagd.',
        '',
    ]

    if (skipped > 0) {
        lines.push(
            `> ${skipped} vraag/vragen hebben geen \`verwachteTrefwoorden\` en tellen niet mee in de`,
            '> scores. Vul die aan in `cases/vragen.jsonl` om ze wel te laten meewegen.',
            '',
        )
    }

    if (failed.length > 0) {
        lines.push(
            `> ${failed.length} configuratie(s) hebben fouten en staan onderaan, ongeacht hun`,
            '> recall@k van 0: dat getal betekent hier "nooit gemeten", niet "niets gevonden". Zie',
            '> `runs.jsonl` voor de foutmelding per model.',
            '',
        )
    }

    lines.push(
        '## Ranglijst',
        '',
        '| # | configId | embeddingmodel | chunk | overlap | topK | recall@k | mrr | topscore | fouten |',
        '|---|---|---|---|---|---|---|---|---|---|',
    )

    rows.forEach((row, index) => {
        lines.push(
            `| ${index + 1} | \`${row.configId}\` | ${row.embeddingModel} | ${row.maxChunkSize} `
            + `| ${row.chunkOverlap} | ${row.topK} | ${nl(row['recall@k'])} | ${nl(row.mrr)} `
            + `| ${nl(row.gemiddeldeTopScore)} | ${row.fouten} |`,
        )
    })

    if (winner) {
        lines.push(
            '',
            '## Volgende stap',
            '',
            `Bovenaan staat \`${winner.configId}\` (${winner.embeddingModel}, chunk `
            + `${winner.maxChunkSize}, overlap ${winner.chunkOverlap}, topK ${winner.topK}).`,
            '',
            'Kijk eerst of het verschil met nummer 2 groot genoeg is om iets te betekenen: bij een',
            'kleine vragenlijst scheelt één vraag al enkele procenten. Kies daarna zelf, en draai:',
            '',
            '```bash',
            `pnpm eval:generate -- --retrieval ${winner.configId}`,
            '```',
        )
    } else if (rows.length > 0) {
        lines.push(
            '',
            '## Volgende stap',
            '',
            'Geen enkele configuratie kon worden gemeten - elk embeddingmodel in deze sweep faalde.',
            'Los de fout op (zie `runs.jsonl` of de terminal-uitvoer van de run) en draai fase 1 opnieuw.',
        )
    }

    await write(file, lines.join('\n'))
}

export interface GenerationSummaryRow {
    label: string
    configId: string
    model: string
    temperature: number
    topP: number
    maxOutputTokens: number
    systemPrompt: string
    antwoorden: number
    fouten: number
    gemiddeldeLengte: number
    gemiddeldeDuurMs: number
    invoerTokens: number
    uitvoerTokens: number
    vlaggen: Record<string, number>
}

export async function writeGenerationSummary(
    file: string,
    sweepName: string,
    retrievalConfigId: string,
    rows: readonly GenerationSummaryRow[],
    caseCount: number,
): Promise<void> {
    const flagKeys = Object.keys(FLAG_LABELS)

    const lines = [
        `# Generatie-sweep "${sweepName}"`,
        '',
        `Gedraaid op ${new Date().toLocaleString('nl-NL')} met retrieval-configuratie \`${retrievalConfigId}\`.`,
        `${rows.length} configuraties x ${caseCount} vragen.`,
        '',
        'Dit bestand bevat **geen oordeel over kwaliteit**. Dat staat in `beoordeling.html`, en dat',
        'oordeel vel jij. Wat hier staat, zijn de dingen die een computer objectief kan vaststellen.',
        '',
        '## Objectieve signalen',
        '',
        ...flagKeys.map((key) => `- **${key}** — ${FLAG_LABELS[key]}`),
        '',
        '| label | configId | model | temp | topP | prompt | antw. | fouten | gem. lengte | gem. duur |',
        '|---|---|---|---|---|---|---|---|---|---|',
    ]

    for (const row of rows) {
        lines.push(
            `| ${row.label} | \`${row.configId}\` | ${row.model} | ${nl(row.temperature)} `
            + `| ${nl(row.topP)} | ${row.systemPrompt} | ${row.antwoorden} | ${row.fouten} `
            + `| ${Math.round(row.gemiddeldeLengte)} | ${formatDuration(row.gemiddeldeDuurMs)} |`,
        )
    }

    lines.push('', '## Vlaggen per configuratie', '', `| label | ${flagKeys.join(' | ')} |`, `|---|${flagKeys.map(() => '---').join('|')}|`)
    for (const row of rows) {
        lines.push(`| ${row.label} | ${flagKeys.map((k) => row.vlaggen[k] ?? 0).join(' | ')} |`)
    }

    lines.push(
        '',
        '## Tokens',
        '',
        '| label | invoer | uitvoer |',
        '|---|---|---|',
        ...rows.map((r) => `| ${r.label} | ${r.invoerTokens} | ${r.uitvoerTokens} |`),
        '',
        'Reken de kosten hier zelf mee door met het tarief van je gateway; de harness kent de',
        'prijzen niet en verzint ze liever niet.',
    )

    await write(file, lines.join('\n'))
}

function nl(value: number): string {
    return String(value).replace('.', ',')
}

function formatDuration(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`.replace('.', ',')
}

async function write(file: string, contents: string): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${contents}\n`, 'utf8')
}
