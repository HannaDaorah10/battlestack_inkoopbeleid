import { createHash } from 'node:crypto'
import { chunkDocument } from '../../../server/utils/rag-chunk'
import { cacheKey, readCache, writeCache } from './cache'
import { embedTexts } from './gateway'
import { runPath } from './paths'
import { MemoryVectorStore } from './vector-store'
import type { CorpusDocument } from './corpus'
import type { EvalCase, RetrievalConfig } from './types'

/**
 * Turning documents into a searchable index, shared by both phases.
 *
 * Phase 2 needs the winning phase-1 index to build its context. Rebuilding it here from the same
 * cache, with the same code, is what makes "the configuration you picked" mean the same thing in
 * both runs - and it usually costs nothing, because phase 1 already paid for the vectors.
 */

/** Key of the store holding every document, used when a question names an organisation the corpus does not have. */
export const ALL_ORGANISATIONS = '*'

/**
 * Changes to the source documents must invalidate the embedding cache, or a re-run silently reuses
 * vectors for text that no longer exists - and reports scores for a corpus nobody has.
 */
export function corpusFingerprint(documents: readonly CorpusDocument[]): string {
    const hash = createHash('sha1')
    for (const doc of documents) hash.update(`${doc.title} ${doc.organisatie} ${doc.text}`)
    return hash.digest('hex').slice(0, 16)
}

export async function embedQuestions(
    sweepName: string,
    model: string,
    cases: readonly EvalCase[],
): Promise<Map<string, number[]>> {
    const key = cacheKey(model, cases.map((c) => c.id).join(','), cases.map((c) => c.vraag).join(' '))
    const file = runPath(sweepName, 'cache', 'vragen', `${key}.json`)

    const cached = await readCache<Record<string, number[]>>(file)
    if (cached) return new Map(Object.entries(cached))

    const vectors = await embedTexts(model, cases.map((c) => c.vraag))
    const byId: Record<string, number[]> = {}
    cases.forEach((c, i) => {
        byId[c.id] = vectors[i]!
    })

    await writeCache(file, byId)
    return new Map(Object.entries(byId))
}

interface CachedIndex {
    chunks: Array<{ text: string, title: string, source: string, organisatie: string }>
    vectors: number[][]
}

/**
 * Build one store per organisation, plus one holding everything.
 *
 * The per-organisation split is how the harness reproduces the app's tenant boundary (see
 * `server/utils/inkoopbeleid/advisor.ts`). Searching both policies at once would flatter the
 * results: the right answer is often reachable from the other organisation's document, and the app
 * would never have looked there.
 */
export async function buildStores(
    sweepName: string,
    indexKeyValue: string,
    shape: Pick<RetrievalConfig, 'embeddingModel' | 'maxChunkSize' | 'chunkOverlap'>,
    documents: readonly CorpusDocument[],
    fingerprint: string,
    log: (message: string) => void = () => {},
): Promise<Map<string, MemoryVectorStore>> {
    const file = runPath(sweepName, 'cache', 'index', `${indexKeyValue}-${fingerprint}.json`)
    let cached = await readCache<CachedIndex>(file)

    if (!cached) {
        const chunks: CachedIndex['chunks'] = []

        for (const doc of documents) {
            const pieces = await chunkDocument({
                text: doc.text,
                title: doc.title,
                source: doc.source,
                metadata: { organisatie: doc.organisatie },
                maxSize: shape.maxChunkSize,
                overlap: shape.chunkOverlap,
            })
            for (const piece of pieces) {
                chunks.push({
                    text: piece.text,
                    title: doc.title,
                    source: doc.source,
                    organisatie: doc.organisatie,
                })
            }
        }

        log(`  ${indexKeyValue}: ${chunks.length} chunks embedden met ${shape.embeddingModel}...`)
        const vectors = await embedTexts(shape.embeddingModel, chunks.map((c) => c.text))
        cached = { chunks, vectors }
        await writeCache(file, cached)
    }

    // Bound to a const before the closure below: narrowing a `let` does not survive into a
    // callback, so the alternative is a non-null assertion on every use.
    const index = cached

    const stores = new Map<string, MemoryVectorStore>()
    stores.set(ALL_ORGANISATIONS, new MemoryVectorStore())
    for (const organisatie of new Set(documents.map((d) => d.organisatie))) {
        stores.set(organisatie, new MemoryVectorStore())
    }

    index.chunks.forEach((chunk, i) => {
        const vector = index.vectors[i]!
        stores.get(ALL_ORGANISATIONS)!.add(vector, chunk)
        stores.get(chunk.organisatie)?.add(vector, chunk)
    })

    return stores
}

export function storeFor(
    stores: Map<string, MemoryVectorStore>,
    organisatie: string,
): MemoryVectorStore {
    return stores.get(organisatie) ?? stores.get(ALL_ORGANISATIONS)!
}
