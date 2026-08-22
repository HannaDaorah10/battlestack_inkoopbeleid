import { queryText } from '#server/utils/rag'
import { gatewayConfigError } from '#server/mastra/gateways/openai-compat'

/**
 * Retrieve-then-generate plumbing, shared by the advisor and the chapter drafter.
 *
 * The scaffold ships only the "retrieve" half: `/api/rag/query` returns scored chunks and never
 * calls a language model. This module is the other half - it turns those chunks into a context
 * block a grounded agent can answer from, and hands back the same sources so the answer stays
 * checkable against the documents it came from.
 */

export interface RetrievedSource {
    title: string
    source: string
    score: number
    text: string
}

export interface RetrievedContext {
    sources: RetrievedSource[]
    /** The excerpts formatted for the model, or an empty string when nothing was retrieved. */
    contextBlock: string
}

/**
 * Fail fast when the AI gateway is not configured.
 *
 * Called before any Mastra work so a missing key surfaces as one clear 503 instead of a retry
 * loop and a stack trace, matching what the chat socket already does.
 */
export function assertGatewayConfigured(): void {
    const configError = gatewayConfigError()
    if (configError) {
        throw createError({
            statusCode: 503,
            statusMessage: configError.message,
            data: { code: configError.code },
        })
    }
}

/**
 * Fetch the excerpts most relevant to `question`, scoped to one organisation.
 *
 * The `organisationId` filter is not optional and not a nicety. Every document in this app
 * shares one vector index, so without it Welbions' question retrieves Ons Huis' thresholds and
 * the advisor answers, fluently and with a citation, using another client's numbers.
 */
export async function retrieveContext(input: {
    organisationId: string
    question: string
    topK?: number
}): Promise<RetrievedContext> {
    const { results } = await queryText(input.question, {
        filter: { organisationId: input.organisationId },
        topK: input.topK,
    })

    const sources: RetrievedSource[] = results.map((r) => ({
        title: String(r.metadata.title ?? ''),
        source: String(r.metadata.source ?? r.metadata.title ?? ''),
        score: r.score,
        text: String(r.metadata.text ?? ''),
    })).filter((s) => s.text.length > 0)

    return { sources, contextBlock: formatContextBlock(sources) }
}

/**
 * Format excerpts for the model.
 *
 * Each excerpt is labelled with the exact source string the prompt tells the agent to cite, so
 * "cite the source" needs no inference: the literal token to echo is already on the page.
 */
export function formatContextBlock(sources: readonly RetrievedSource[]): string {
    if (sources.length === 0) return ''
    return sources
        .map((s, i) => `--- Fragment ${i + 1} | bron: ${s.source} ---\n${s.text}`)
        .join('\n\n')
}

/** Dutch stand-in used when retrieval comes back empty, so the agent is never asked to answer from nothing. */
export const NO_CONTEXT_NOTICE
    = 'Er zijn geen fragmenten gevonden in de documenten van deze organisatie.'
