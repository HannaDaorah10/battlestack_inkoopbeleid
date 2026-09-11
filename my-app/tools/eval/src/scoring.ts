import { containsAllKeywords } from './checks'
import type { RetrievalSummaryRow } from './report/markdown'
import type { EvalCase, RetrievalConfig, RetrievalRun } from './types'

/**
 * Pure scoring logic for phase 1 (retrieval): turning raw vector-store hits into a `RetrievalRun`,
 * and turning a run of those into a ranked summary.
 *
 * Kept out of `retrieval.ts` on purpose: that file is a CLI entrypoint that calls `main()` at
 * import time, which would make importing it for a unit test also run a sweep.
 */

export function scoreRun(
    config: RetrievalConfig,
    evalCase: EvalCase,
    hits: ReadonlyArray<{ rank: number, score: number, chunk: { source: string, text: string } }>,
    durationMs: number,
): RetrievalRun {
    const fragments = hits.slice(0, config.topK).map((h) => ({
        rank: h.rank,
        score: h.score,
        source: h.chunk.source,
        text: h.chunk.text,
    }))

    const scoreable = evalCase.verwachteTrefwoorden.length > 0
    const firstHit = scoreable
        ? fragments.find((f) => containsAllKeywords(f.text, evalCase.verwachteTrefwoorden))
        : undefined

    return {
        configId: config.configId,
        caseId: evalCase.id,
        scoreable,
        hit: firstHit !== undefined,
        firstHitRank: firstHit?.rank ?? 0,
        reciprocalRank: firstHit ? 1 / firstHit.rank : 0,
        topScore: fragments[0]?.score ?? 0,
        fragments,
        durationMs,
        error: null,
    }
}

/** One row for a configuration whose embedding model or index never got the chance to run. */
export function errorRun(config: RetrievalConfig, evalCase: EvalCase, message: string): RetrievalRun {
    return {
        configId: config.configId,
        caseId: evalCase.id,
        scoreable: evalCase.verwachteTrefwoorden.length > 0,
        hit: false,
        firstHitRank: 0,
        reciprocalRank: 0,
        topScore: 0,
        fragments: [],
        durationMs: 0,
        error: message,
    }
}

export function summarise(
    configs: readonly RetrievalConfig[],
    runs: readonly RetrievalRun[],
): RetrievalSummaryRow[] {
    const byConfig = new Map<string, RetrievalRun[]>()
    for (const run of runs) {
        const bucket = byConfig.get(run.configId) ?? []
        bucket.push(run)
        byConfig.set(run.configId, bucket)
    }

    const rows = configs.map((config) => {
        const runsFor = byConfig.get(config.configId) ?? []
        // Runs with an error never reached the index - their embedding model or store failed -
        // so they are excluded here rather than counted as misses, the same distinction phase 2
        // draws between an answer and a cell that errored before producing one.
        const ok = runsFor.filter((r) => r.error === null)
        const scoreable = ok.filter((r) => r.scoreable)
        const hits = scoreable.filter((r) => r.hit).length

        return {
            'configId': config.configId,
            'embeddingModel': config.embeddingModel,
            'maxChunkSize': config.maxChunkSize,
            'chunkOverlap': config.chunkOverlap,
            'topK': config.topK,
            'beoordeeldeVragen': scoreable.length,
            'gevonden': hits,
            'recall@k': scoreable.length > 0 ? round(hits / scoreable.length) : 0,
            'mrr': scoreable.length > 0 ? round(mean(scoreable.map((r) => r.reciprocalRank))) : 0,
            'gemiddeldeTopScore': ok.length > 0 ? round(mean(ok.map((r) => r.topScore))) : 0,
            'fouten': runsFor.length - ok.length,
        }
    })

    // Recall first, then MRR: finding the passage at all beats finding it slightly higher up.
    // Fewer errors breaks a remaining tie, so a configuration that was actually measured at zero
    // never ends up indistinguishable from one that failed outright and was never measured at all.
    rows.sort((a, b) => (b['recall@k'] - a['recall@k']) || (b.mrr - a.mrr) || (a.fouten - b.fouten))
    return rows
}

function mean(values: readonly number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function round(value: number): number {
    return Math.round(value * 1000) / 1000
}
