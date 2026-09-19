import { normaliseForMatch } from './checks'
import type { SearchHit, StoredChunk } from './vector-store'

/**
 * In-memory keyword search, the harness's stand-in for the app's Postgres full-text path.
 *
 * READ THIS BEFORE TRUSTING A HYBRID NUMBER. Unlike chunking and prompt building - which the
 * harness shares with the app outright - this is an *approximation*, and the README says so too.
 * The app runs `to_tsvector('dutch', ...)` inside Postgres: Snowball stemming, a real Dutch
 * stopword list, and `ts_rank_cd` cover-density ranking. Reproducing that faithfully in JavaScript
 * is not realistic, and the harness must keep running with no database at all (that constraint is
 * what makes it usable by a colleague with only an API key).
 *
 * Where the two differ:
 *
 * - No stemming. "offertes" does not match "offerte" here; in Postgres it does.
 * - A short hand-written stopword list instead of Postgres's Dutch dictionary.
 * - Cover density (how tightly the matched terms cluster) is not modelled; this ranks on how many
 *   distinct query terms a chunk contains, then on how often.
 *
 * Why it is still worth measuring: the failure hybrid search is meant to fix here is the exact
 * one stemming does not touch. A question about "EUR 250.000" has to land on the chunk holding
 * that literal figure, and numbers are not stemmed in either system. `normaliseForMatch` - the
 * same function phase 1 already uses to decide whether a fragment contains an expected keyword -
 * folds "250.000", "250 000" and "250000" together, so amounts match the way the rest of the
 * harness already assumes they do.
 *
 * The consequence for reading results: treat the hybrid/dense *direction* as the finding, and the
 * exact recall figure of a hybrid configuration as indicative rather than exact.
 */

/**
 * Enough of the Dutch function words to stop them dominating a ranking that has no IDF term.
 * Deliberately short: every word here is one a chunk can no longer be found by, so the bar is
 * "carries no retrieval signal in any question we would ask", not "is common".
 */
const DUTCH_STOPWORDS = new Set([
    'aan', 'af', 'al', 'als', 'bij', 'dan', 'dat', 'de', 'der', 'den', 'die', 'dit', 'door',
    'een', 'en', 'er', 'geen', 'had', 'heb', 'heeft', 'het', 'hij', 'hoe', 'ik', 'in', 'is',
    'je', 'kan', 'me', 'meer', 'met', 'moet', 'na', 'naar', 'niet', 'nog', 'of', 'om', 'ons',
    'onze', 'ook', 'op', 'over', 'te', 'tot', 'uit', 'van', 'veel', 'voor', 'want', 'was',
    'wat', 'we', 'wel', 'werd', 'wij', 'worden', 'wordt', 'zijn', 'zo', 'zou',
])

/**
 * Split text into comparable terms.
 *
 * Runs `normaliseForMatch` first, so thousand separators inside amounts are already folded away
 * and "EUR 30.000" arrives here as "eur 30000" - one term for the amount, matching however the
 * PDF happened to write it.
 */
export function tokenise(text: string): string[] {
    return normaliseForMatch(text)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 1 && !DUTCH_STOPWORDS.has(token))
}

export class MemoryKeywordStore {
    private readonly chunks: StoredChunk[] = []
    private readonly termCounts: Array<Map<string, number>> = []

    add(chunk: StoredChunk): void {
        const counts = new Map<string, number>()
        for (const token of tokenise(chunk.text)) {
            counts.set(token, (counts.get(token) ?? 0) + 1)
        }
        this.chunks.push(chunk)
        this.termCounts.push(counts)
    }

    get size(): number {
        return this.chunks.length
    }

    /**
     * Chunks containing any of the question's terms, best first.
     *
     * Ranked on distinct terms matched, then total occurrences - no IDF, matching `ts_rank_cd`,
     * which has none either. `score` is the fraction of the question's terms the chunk contains
     * (0-1), reported for readability; the ordering is the comparator below, not the score.
     */
    query(question: string, limit: number): SearchHit[] {
        const terms = [...new Set(tokenise(question))]
        if (terms.length === 0) return []

        const scored: Array<{ distinct: number, total: number, index: number }> = []
        for (let i = 0; i < this.chunks.length; i++) {
            const counts = this.termCounts[i]!
            let distinct = 0
            let total = 0
            for (const term of terms) {
                const n = counts.get(term)
                if (n) {
                    distinct++
                    total += n
                }
            }
            if (distinct > 0) scored.push({ distinct, total, index: i })
        }

        // Insertion order breaks remaining ties, so two identical runs rank identically - the same
        // reason MemoryVectorStore sorts by index last.
        scored.sort((a, b) => (b.distinct - a.distinct) || (b.total - a.total) || (a.index - b.index))

        return scored.slice(0, limit).map((s, i) => ({
            rank: i + 1,
            score: s.distinct / terms.length,
            chunk: this.chunks[s.index]!,
        }))
    }
}
