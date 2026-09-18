import type { GenerationRun } from './types'

/**
 * Which generation configurations phase 2 puts in front of a human reviewer.
 *
 * Reviewer time is the scarce resource, not model calls: a configuration's answers have to exist
 * before checks.ts's heuristic flags can be counted on them, so every configuration still gets
 * generated - this only narrows which ones make it into `beoordeling.html`. The rest stay fully
 * visible in `runs.jsonl`/`resultaten.csv`/`samenvatting.md`, so nothing is hidden, only kept off
 * the page a colleague has to read.
 */

export interface ConfigHeuristicScore {
    configId: string
    /** Cells that errored before producing an answer at all - weighted above flags: a missing
     * answer is worse than a flagged one. */
    fouten: number
    /** Total checks.ts flags across every answer this configuration produced. */
    flagCount: number
    antwoorden: number
}

export function scoreConfigsByHeuristics(
    configIds: readonly string[],
    runs: readonly GenerationRun[],
): ConfigHeuristicScore[] {
    return configIds.map((configId) => {
        const own = runs.filter((r) => r.configId === configId)
        return {
            configId,
            fouten: own.filter((r) => r.error !== null).length,
            flagCount: own.reduce((sum, r) => sum + r.flags.length, 0),
            antwoorden: own.length,
        }
    })
}

/**
 * The `topN` configurations with the fewest failed cells, then the fewest flags overall. Ties
 * (e.g. two configurations with zero of either) keep the order `configIds` was given in, so the
 * choice among equals is the sweep's own ordering, not an arbitrary sort artefact.
 */
export function selectConfigsForReview(
    configIds: readonly string[],
    runs: readonly GenerationRun[],
    topN: number,
): string[] {
    const scored = scoreConfigsByHeuristics(configIds, runs)
    scored.sort((a, b) => (a.fouten - b.fouten) || (a.flagCount - b.flagCount))
    return scored.slice(0, Math.max(0, topN)).map((s) => s.configId)
}
