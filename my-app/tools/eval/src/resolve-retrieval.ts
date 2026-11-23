import { readFile } from 'node:fs/promises'
import { runPath } from './paths'
import type { RetrievalConfig } from './types'

/**
 * Which retrieval configuration a phase-2 command builds on: `pnpm eval:generate` for the context,
 * `pnpm eval:aggregate` for the directory to read reviews back from. Shared so both resolve the
 * same way and a run's generation output always lands under the retrieval configuration that
 * produced its context (see `generation.ts` / `aggregate.ts`).
 *
 * Defaults to the phase-1 winner, but says so out loud. Silently picking one would make a report
 * unreproducible: two runs of "the same" sweep could rest on different retrieval settings without
 * anything in the output showing it.
 */
export async function resolveRetrieval(sweepName: string, wanted: string | null): Promise<RetrievalConfig> {
    const file = runPath(sweepName, 'retrieval', 'ranglijst.json')
    let parsed: { configs: RetrievalConfig[], rows: Array<{ configId: string }> }

    try {
        parsed = JSON.parse(await readFile(file, 'utf8'))
    } catch {
        throw new Error(
            `Geen fase-1 resultaten op ${file}.\n`
            + 'Draai eerst: pnpm eval:retrieval',
        )
    }

    if (wanted) {
        const found = parsed.configs.find((c) => c.configId === wanted)
        if (!found) {
            throw new Error(
                `Retrieval-configuratie "${wanted}" komt niet voor in ${file}.\n`
                + `Beschikbaar: ${parsed.configs.map((c) => c.configId).join(', ')}`,
            )
        }
        return found
    }

    const best = parsed.rows[0]
    const found = best ? parsed.configs.find((c) => c.configId === best.configId) : undefined
    if (!found) throw new Error(`${file} bevat geen bruikbare ranglijst; draai fase 1 opnieuw.`)

    console.log(`  geen --retrieval opgegeven; de winnaar van fase 1 wordt gebruikt`)
    return found
}
