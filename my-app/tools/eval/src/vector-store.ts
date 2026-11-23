/**
 * Brute-force cosine similarity over an in-memory list of vectors.
 *
 * Deliberately not pgvector. A sweep varies the embedding model and the chunk size, so every
 * configuration needs its own index at its own width - in Postgres that means creating and
 * dropping a table per cell, and one mistake writes into the app's live `rag_vectors`. Here an
 * index is an array that disappears when the process exits: the harness needs no database and no
 * Docker, and cells can run in parallel without fighting over shared state.
 *
 * The approximation argument runs the opposite way from what you might expect: pgvector's HNSW
 * index is the approximate one. Scanning every vector is exact, and across a few policy documents
 * (hundreds of chunks, not millions) it costs microseconds.
 */

export interface StoredChunk {
    text: string
    title: string
    source: string
}

export interface SearchHit {
    rank: number
    score: number
    chunk: StoredChunk
}

export class MemoryVectorStore {
    /** Vectors are normalised on insert, so a query is a plain dot product. */
    private readonly vectors: Float64Array[] = []
    private readonly chunks: StoredChunk[] = []

    add(vector: readonly number[], chunk: StoredChunk): void {
        this.vectors.push(normalise(vector))
        this.chunks.push(chunk)
    }

    get size(): number {
        return this.chunks.length
    }

    query(vector: readonly number[], topK: number): SearchHit[] {
        const q = normalise(vector)
        const scored: Array<{ score: number, index: number }> = []

        for (let i = 0; i < this.vectors.length; i++) {
            scored.push({ score: dot(q, this.vectors[i]!), index: i })
        }

        // Sort by score, then by insertion order: ties must break identically on every run,
        // otherwise two identical configurations report different fragments and the difference
        // reads as a real finding.
        scored.sort((a, b) => (b.score - a.score) || (a.index - b.index))

        return scored.slice(0, topK).map((s, i) => ({
            rank: i + 1,
            score: s.score,
            chunk: this.chunks[s.index]!,
        }))
    }
}

function normalise(vector: readonly number[]): Float64Array {
    const out = new Float64Array(vector.length)
    let sum = 0
    for (let i = 0; i < vector.length; i++) sum += vector[i]! * vector[i]!
    const length = Math.sqrt(sum)
    // A zero vector has no direction, so leaving it at zero scores 0 against everything - the
    // honest answer. Dividing would produce NaN and poison the entire ranking.
    if (length === 0) return out
    for (let i = 0; i < vector.length; i++) out[i] = vector[i]! / length
    return out
}

function dot(a: Float64Array, b: Float64Array): number {
    let sum = 0
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) sum += a[i]! * b[i]!
    return sum
}
