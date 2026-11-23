import { queryText } from '#server/utils/rag'
import { gatewayConfigError } from '#server/mastra/gateways/openai-compat'
import { formatContextBlock, type RetrievedSource } from '#server/utils/inkoopbeleid/advice-prompt'

/**
 * Retrieve-then-generate plumbing, shared by the advisor and the chapter drafter.
 *
 * The scaffold ships only the "retrieve" half: `/api/rag/query` returns scored chunks and never
 * calls a language model. This module is the other half - it turns those chunks into a context
 * block a grounded agent can answer from, and hands back the same sources so the answer stays
 * checkable against the documents it came from.
 *
 * The pure prompt-shaping pieces (`formatContextBlock`, `buildAdvicePrompt`, `NO_CONTEXT_NOTICE`,
 * `RetrievedSource`) live in `advice-prompt.ts` so they can be imported without a database
 * connection; see the note at the top of that file.
 */

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
