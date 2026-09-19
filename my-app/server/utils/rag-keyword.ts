import { sql } from 'drizzle-orm'
import { db } from '#server/database/client'
import type { FusionCandidate } from '#server/utils/rag-fusion'
import type { RagFilter } from '#server/utils/rag'

/**
 * The keyword half of hybrid retrieval: Postgres full-text search over the same `rag_vectors`
 * rows the dense path searches.
 *
 * Dense search misses things keyword search finds trivially. A question about a threshold of
 * "EUR 250.000" has to land on the one chunk holding that exact figure, and embeddings are not
 * built to distinguish 250.000 from 25.000 - they encode "a procurement amount", which every
 * chunk in a procurement policy is about. Literal matching is what pins the right row.
 *
 * `rag_vectors` is created and owned by `@mastra/pg`'s `PgVector`, not by a drizzle schema, and
 * the chunk text lives inside its `metadata` JSONB. So the searchable column is added here, as a
 * GENERATED column, which is what keeps it correct without touching upsert: `PgVector.upsert()`
 * knows nothing about this column, and a generated column does not need it to.
 */

const TSVECTOR_COLUMN = 'content_tsv'
const GIN_INDEX = 'rag_vectors_content_tsv_idx'

/**
 * Dutch, not `simple`, so "offertes" matches "offerte" and stopwords like "van"/"het" stop
 * dominating the query. The two-argument form is required: `to_tsvector(text)` alone is STABLE,
 * not IMMUTABLE, and a generated column only accepts an immutable expression.
 */
const TEXT_SEARCH_CONFIG = 'dutch'

/** A table name from our own constants, never user input, but interpolated - so assert the shape. */
function assertSafeIdentifier(name: string): void {
    if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
        throw new Error(`Refusing to build SQL with an unsafe identifier: ${name}`)
    }
}

/**
 * Add the full-text column and its GIN index, idempotently.
 *
 * Called from `rag.ts` right after `PgVector.createIndex()` has guaranteed the table exists -
 * that table is created lazily on first ingest, so no boot-time migration can reach it.
 *
 * NOTE: `ADD COLUMN ... GENERATED ... STORED` rewrites the table and holds an ACCESS EXCLUSIVE
 * lock while it does. Fine at this corpus size (a few hundred chunks); it would need a planned
 * window on a large one.
 *
 * Runs regardless of whether hybrid retrieval is switched on, so `NUXT_RAG_RETRIEVAL=hybrid`
 * takes effect on restart alone, with no backfill step and no second deploy.
 */
export async function ensureKeywordIndex(table: string): Promise<void> {
    assertSafeIdentifier(table)

    try {
        await db.execute(sql.raw(`
            ALTER TABLE ${table}
            ADD COLUMN IF NOT EXISTS ${TSVECTOR_COLUMN} tsvector
            GENERATED ALWAYS AS (to_tsvector('${TEXT_SEARCH_CONFIG}', coalesce(metadata->>'text', ''))) STORED
        `))
        await db.execute(sql.raw(
            `CREATE INDEX IF NOT EXISTS ${GIN_INDEX} ON ${table} USING GIN (${TSVECTOR_COLUMN})`,
        ))
    } catch {
        // Hold, don't throw: two replicas running this DDL at once can collide even with
        // IF NOT EXISTS. The catalog check below is the authority on whether it actually landed,
        // exactly as `initIndex` treats `createIndex` vs `describeIndex`.
    }

    const rows = await db.execute(sql`
        SELECT
            (SELECT count(*) FROM information_schema.columns
              WHERE table_name = ${table} AND column_name = ${TSVECTOR_COLUMN}) AS columns,
            (SELECT count(*) FROM pg_indexes
              WHERE tablename = ${table} AND indexname = ${GIN_INDEX}) AS indexes
    `)
    const found = (rows as unknown as Array<{ columns: string | number, indexes: string | number }>)[0]
    if (Number(found?.columns ?? 0) === 0 || Number(found?.indexes ?? 0) === 0) {
        throw new Error(
            `Could not create the full-text column "${TSVECTOR_COLUMN}" or index "${GIN_INDEX}" on `
            + `"${table}". Hybrid retrieval needs both. Check that the Postgres text search `
            + `configuration "${TEXT_SEARCH_CONFIG}" exists on this server.`,
        )
    }
}

/**
 * Full-text search, ranked, scoped by the same metadata filter the dense path uses.
 *
 * The tenant filter is not optional here for the same reason it is not optional there: one table
 * holds every organisation's chunks, and a keyword path without the filter would hand back
 * another organisation's thresholds just as happily as the vector path would.
 *
 * The query is built from the *lexemes Postgres itself derives* from the question and OR-ed
 * together. Both `plainto_tsquery` and `websearch_to_tsquery` AND their terms, which for a real
 * question ("Hoeveel offertes heb ik nodig voor een schoonmaakcontract van EUR 30.000?") means
 * demanding every word appear in one chunk - reliably zero hits. Going through
 * `unnest(to_tsvector(...))` also means stopword removal and stemming happen once, in Postgres,
 * with no hand-rolled escaping: `quote_literal` makes each lexeme safe for `to_tsquery`.
 */
export async function keywordSearch(opts: {
    table: string
    query: string
    filter?: RagFilter
    limit: number
}): Promise<FusionCandidate[]> {
    assertSafeIdentifier(opts.table)

    // `metadata ->> ${key}` parameterises the key as a value (jsonb ->> text), so a metadata key
    // never reaches the statement as interpolated SQL. The ::text cast picks that overload.
    const filters = Object.entries(opts.filter ?? {}).map(
        ([key, value]) => sql` AND metadata ->> ${key}::text = ${String(value)}`,
    )

    const rows = await db.execute(sql`
        WITH q AS (
            SELECT to_tsquery(
                ${TEXT_SEARCH_CONFIG}::regconfig,
                string_agg(quote_literal(lexeme), ' | ')
            ) AS query
            -- Casts are explicit because to_tsvector/to_tsquery each have text, json and jsonb
            -- overloads: an untyped parameter leaves Postgres unable to pick one.
            FROM unnest(to_tsvector(${TEXT_SEARCH_CONFIG}::regconfig, ${opts.query}::text))
        )
        SELECT
            v.vector_id AS id,
            v.metadata AS metadata,
            ts_rank_cd(v.${sql.raw(TSVECTOR_COLUMN)}, q.query) AS kw_rank
        FROM ${sql.raw(opts.table)} v, q
        WHERE q.query IS NOT NULL
          AND v.${sql.raw(TSVECTOR_COLUMN)} @@ q.query
          ${sql.join(filters, sql``)}
        ORDER BY kw_rank DESC, v.vector_id
        LIMIT ${opts.limit}
    `)

    return (rows as unknown as Array<{ id: string, metadata: Record<string, unknown> | null }>)
        .map((row) => ({ id: row.id, metadata: row.metadata ?? {} }))
}
