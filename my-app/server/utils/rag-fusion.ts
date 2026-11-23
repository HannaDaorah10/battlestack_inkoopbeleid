/**
 * Reciprocal Rank Fusion: merge several ranked result lists into one.
 *
 * Lives in its own module, apart from `rag.ts`, for the same reason `rag-chunk.ts` does: the
 * evaluation harness under `tools/eval` needs exactly this step and must stay able to run with no
 * database at all, while `rag.ts` pulls in a database client through `mastra/utils/ai-model`.
 *
 * RRF scores a document by where it *ranks* in each list, never by the scores the lists carry:
 * `score = sum over lists of 1 / (k + rank)`. That is the whole point here. A cosine similarity of
 * 0.42 and a `ts_rank_cd` of 0.08 are numbers from different scales with no meaningful conversion
 * between them, so any attempt to add or weight them directly would be inventing a relationship
 * that does not exist. Ranks are comparable by construction.
 *
 * `k` damps the head of each list: with k=60 (the value from the original Cormack et al. paper,
 * and the de-facto default since) the gap between rank 1 and rank 2 is small, so a document both
 * lists rank modestly beats one that a single list ranks first. That is the behaviour we want
 * here - agreement between dense and keyword search is the signal.
 */

export const DEFAULT_RRF_K = 60

/**
 * How many candidates each path contributes before fusion. Deeper than `topK` on purpose: a chunk
 * that lands at rank 12 in one path and rank 2 in the other is exactly the agreement RRF is meant
 * to reward, and it can only do that if rank 12 was fetched at all.
 *
 * Shared with `tools/eval` rather than duplicated: candidate depth changes which chunks can be
 * fused at all, so a harness using a different depth would sweep a pipeline the app does not run.
 */
export function candidateDepth(topK: number): number {
    return Math.max(topK * 4, 20)
}

export interface FusionCandidate {
    /** Stable identity of the chunk, used to recognise the same chunk across lists. */
    id: string
    metadata: Record<string, unknown>
}

export interface FusedHit {
    id: string
    metadata: Record<string, unknown>
    /** The RRF score this hit was ordered by. Not comparable to a cosine similarity. */
    score: number
    /** 1-based rank per input list, or null when that list did not return this chunk at all. */
    ranks: Record<string, number | null>
}

/**
 * Fuse named ranked lists, best-first, into one ranked list.
 *
 * Lists are named (`{ dense: [...], keyword: [...] }`) rather than positional so `ranks` on the
 * way out says which path found a chunk and where - the thing you actually want to look at when
 * a hybrid result surprises you.
 *
 * Each list must already be sorted best-first; position in the array *is* the rank. A chunk
 * appearing twice in one list keeps its first (best) position.
 */
export function fuseRrf(
    lists: Readonly<Record<string, readonly FusionCandidate[]>>,
    opts: { k?: number, topK: number },
): FusedHit[] {
    const k = opts.k ?? DEFAULT_RRF_K
    const names = Object.keys(lists)
    const byId = new Map<string, FusedHit>()

    for (const name of names) {
        const list = lists[name] ?? []
        list.forEach((candidate, index) => {
            const rank = index + 1
            let hit = byId.get(candidate.id)
            if (!hit) {
                hit = {
                    id: candidate.id,
                    metadata: candidate.metadata,
                    score: 0,
                    // Every list gets a key, so a null reads as "this path did not find it"
                    // rather than as a missing field.
                    ranks: Object.fromEntries(names.map((n) => [n, null])),
                }
                byId.set(candidate.id, hit)
            }
            // A duplicate id within one list keeps its best rank and is not scored twice.
            if (hit.ranks[name] !== null) return
            hit.ranks[name] = rank
            hit.score += 1 / (k + rank)
        })
    }

    return [...byId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, opts.topK))
}
