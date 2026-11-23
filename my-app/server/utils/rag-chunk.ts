import { MDocument } from '@mastra/rag'

/**
 * Split a document into the chunks that get embedded.
 *
 * Lives in its own module, apart from `rag.ts`, so it can be imported without dragging in a
 * database client: `rag.ts` reaches the active embedding model through `mastra/utils/ai-model`,
 * which imports `database/client`. The evaluation harness under `tools/eval` needs exactly this
 * step and nothing else, and it must stay able to run with no database at all.
 *
 * Keeping it shared rather than copied is the point: chunk size and overlap are the two knobs a
 * retrieval sweep varies, so the harness has to chunk the way the app chunks or it measures a
 * pipeline that does not exist.
 */

export type DocumentChunk = Awaited<ReturnType<MDocument['chunk']>>[number]

export interface ChunkDocumentOptions {
    text: string
    title: string
    source: string
    metadata?: Record<string, unknown>
    maxSize: number
    overlap: number
}

export function chunkDocument(opts: ChunkDocumentOptions): Promise<DocumentChunk[]> {
    const doc = MDocument.fromText(opts.text, {
        title: opts.title,
        source: opts.source,
        ...opts.metadata,
    })

    return doc.chunk({
        strategy: 'recursive',
        maxSize: opts.maxSize,
        overlap: opts.overlap,
    })
}
