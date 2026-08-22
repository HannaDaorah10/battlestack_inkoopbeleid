import { MDocument } from '@mastra/rag'
import { PgVector } from '@mastra/pg'
import { embedMany } from 'ai'
import { createError } from 'h3'
import { gatewayEmbedding } from '#server/mastra/gateways/openai-compat'
import { getActiveEmbeddingModelId } from '#server/mastra/utils/ai-model'

export const INDEX_NAME = 'rag_vectors'

let _store: PgVector | null = null
let _embeddingModel: ReturnType<typeof gatewayEmbedding> | null = null
let _embeddingModelId: string | null = null
let _initPromise: Promise<void> | null = null

interface RagConfig {
    maxChunkSize: number
    chunkOverlap: number
    topK: number
    embeddingDimensions: number
    embeddingModel: string
    databaseUrl: string
}

/**
 * Metadata equality filter passed straight to pgvector, e.g. `{ organisationId: '…' }`.
 * One index (`rag_vectors`) is shared by every document in the app, so a caller that owns a
 * tenant boundary MUST filter on it: without one, organisation A's question retrieves
 * organisation B's excerpts. Keys must match what the corresponding `ingestText` wrote.
 */
export type RagFilter = Record<string, string | number | boolean>

function readConfig(): RagConfig {
    const config = useRuntimeConfig() as unknown as {
        databaseUrl?: unknown
        rag?: {
            // Key names mirror the NUXT_RAG_* env vars (NUXT_RAG_MAX_CHUNK_SIZE → rag.maxChunkSize); Nuxt binds env onto these exact paths.
            maxChunkSize?: unknown
            chunkOverlap?: unknown
            topK?: unknown
            embeddingDimensions?: unknown
            embeddingModel?: unknown
        }
    }
    const rag = config.rag ?? {}
    return {
        maxChunkSize: Number(rag.maxChunkSize ?? 512),
        chunkOverlap: Number(rag.chunkOverlap ?? 50),
        topK: Number(rag.topK ?? 5),
        embeddingDimensions: Number(rag.embeddingDimensions ?? 1536),
        embeddingModel: String(rag.embeddingModel ?? 'openai/text-embedding-3-small'),
        databaseUrl: String(config.databaseUrl ?? ''),
    }
}

function getStore(cfg: RagConfig): PgVector {
    if (!_store) {
        _store = new PgVector({ id: 'rag', connectionString: cfg.databaseUrl })
    }
    return _store
}

// Admin-controllable via `ai_model_configs.embedding`, memoised by id so a change takes effect without rebuilding the model object.
// HAZARD: switching to a model with a different vector dimension requires reindexing; the pgvector column width is fixed at index creation.
async function getModel(cfg: RagConfig): Promise<ReturnType<typeof gatewayEmbedding>> {
    const id = await getActiveEmbeddingModelId(cfg.embeddingModel || undefined)
    if (!_embeddingModel || _embeddingModelId !== id) {
        _embeddingModel = gatewayEmbedding(id)
        _embeddingModelId = id
    }
    return _embeddingModel
}

/**
 * Create the index once per process, then READ ITS REAL WIDTH BACK and refuse to continue on a mismatch.
 *
 * The read-back is the whole point. `PgVector.createIndex` issues
 * `CREATE TABLE IF NOT EXISTS … embedding vector(<dimension>)`, so against a table that already
 * exists at a DIFFERENT width the statement is a silent no-op: nothing throws here, and the
 * mismatch only resurfaces later as an opaque upsert failure far from its cause. Comparing the
 * stored width against the configured one turns that into a one-line, actionable diagnosis.
 */
function ensureIndex(cfg: RagConfig): Promise<void> {
    if (_initPromise) return _initPromise
    _initPromise = initIndex(cfg).catch((err: unknown) => {
        // Clear the memo so a later call retries instead of replaying a rejected promise forever
        // (an operator who fixes the config and reingests should not have to restart the process).
        _initPromise = null
        throw err
    })
    return _initPromise
}

async function initIndex(cfg: RagConfig): Promise<void> {
    const store = getStore(cfg)
    let createError_: unknown = null
    try {
        await store.createIndex({ indexName: INDEX_NAME, dimension: cfg.embeddingDimensions })
    } catch (err) {
        // Hold, don't throw: a concurrent replica creating the same index races here, and
        // describeIndex below is the authority on whether the index is actually usable.
        createError_ = err
    }

    let dimension: number
    try {
        ;({ dimension } = await store.describeIndex({ indexName: INDEX_NAME }))
    } catch (err) {
        throw createError_ ?? err
    }

    if (dimension !== cfg.embeddingDimensions) {
        const message
            = `RAG vector index "${INDEX_NAME}" stores ${dimension}-dimension vectors but `
                + `NUXT_RAG_EMBEDDING_DIMENSIONS is ${cfg.embeddingDimensions}. `
                + `Set the env var to ${dimension}, or drop the index `
                + `(DROP TABLE ${INDEX_NAME};) and restart to rebuild it at ${cfg.embeddingDimensions}. `
                + 'The dimension must equal what the active embedding model returns '
                + '(openai/text-embedding-3-small returns 1536).'
        console.error(`[rag] ${message}`)
        throw createError({ statusCode: 500, statusMessage: message })
    }
}

export async function ingestText(opts: {
    title: string
    source: string
    text: string
    metadata?: Record<string, unknown>
}): Promise<{ chunks: number }> {
    const cfg = readConfig()
    await ensureIndex(cfg)
    const doc = MDocument.fromText(opts.text, {
        title: opts.title,
        source: opts.source,
        ...opts.metadata,
    })

    const chunks = await doc.chunk({
        strategy: 'recursive',
        maxSize: cfg.maxChunkSize,
        overlap: cfg.chunkOverlap,
    })

    const { embeddings } = await embedMany({
        model: await getModel(cfg),
        values: chunks.map((c) => c.text),
    })

    await getStore(cfg).upsert({
        indexName: INDEX_NAME,
        vectors: embeddings,
        metadata: chunks.map((c) => ({
            text: c.text,
            title: opts.title,
            source: opts.source,
            ...opts.metadata,
            ...c.metadata,
        })),
    })

    return { chunks: chunks.length }
}

/**
 * Semantic search over the shared index.
 *
 * `opts.filter` narrows by chunk metadata before scoring, which is how a multi-tenant caller
 * keeps organisations apart (see {@link RagFilter}). Omitting it searches everything ingested
 * by every feature, which is correct for the generic `/dashboard/rag` page and wrong anywhere
 * a tenant boundary exists.
 */
export async function queryText(
    query: string,
    opts: { filter?: RagFilter, topK?: number } = {},
): Promise<{
    results: Array<{ score: number, metadata: Record<string, unknown> }>
}> {
    const cfg = readConfig()
    await ensureIndex(cfg)
    const { embeddings } = await embedMany({
        model: await getModel(cfg),
        values: [query],
    })

    const raw = await getStore(cfg).query({
        indexName: INDEX_NAME,
        queryVector: embeddings[0]!,
        topK: opts.topK ?? cfg.topK,
        // Undefined rather than `{}`: an empty object is a filter with no conditions, which the
        // pg translator still compiles into a WHERE clause.
        filter: opts.filter && Object.keys(opts.filter).length > 0 ? opts.filter : undefined,
    })

    const results = raw.map((r) => ({
        score: r.score,
        metadata: r.metadata ?? {},
    }))

    return { results }
}
