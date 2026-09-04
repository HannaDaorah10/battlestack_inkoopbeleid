import { embedMany, generateText } from 'ai'
import {
    gatewayChatModel,
    gatewayEmbedding,
} from '../../../server/mastra/gateways/openai-compat'
import { withRetry } from './pool'

/**
 * The two calls a sweep makes, wrapped with retries.
 *
 * Both go through `server/mastra/gateways/openai-compat.ts` rather than constructing an SDK client
 * here, so the harness inherits the same base URL handling, auth and `NUXT_AI_GATEWAY_HEADERS`
 * (including the sluis.ai residency header) that the app uses. A second client would be a second
 * set of headers to keep in sync, and the one that silently drifted would be this one.
 */

export interface GenerateResult {
    text: string
    finishReason: string | null
    inputTokens: number | null
    outputTokens: number | null
}

export async function embedTexts(
    modelId: string,
    values: readonly string[],
    opts: { maxParallelCalls?: number } = {},
): Promise<number[][]> {
    if (values.length === 0) return []

    // `embedMany` already splits the list into the provider's per-call maximum; capping parallelism
    // is what keeps a corpus of several hundred chunks from arriving as one burst of 429s.
    const { embeddings } = await withRetry(() => embedMany({
        model: gatewayEmbedding(modelId),
        values: [...values],
        maxParallelCalls: opts.maxParallelCalls ?? 2,
    }))

    return embeddings.map((e) => [...e])
}

/**
 * `topP: 1` is the neutral value - it excludes nothing and changes no output - so it is dropped
 * rather than sent.
 *
 * That is not a micro-optimisation. Anthropic's API rejects a request carrying both `temperature`
 * and `top_p`, and returns a bare "Bad Request"; measured against
 * `bedrock/eu.anthropic.claude-sonnet-4-5` on sluis.ai, sending either one alone succeeds and
 * sending both fails every time. Since `topP` defaults to 1 in a sweep, always sending it would
 * make every Claude cell fail for a reason the report could not explain.
 *
 * Deliberately sweeping `topP` away from 1 therefore excludes Anthropic models. That is a real
 * trade-off, not a bug: those cells record their error and the rest of the run continues.
 */
export function samplingParams(temperature: number, topP: number): { temperature: number, topP?: number } {
    return topP === 1 ? { temperature } : { temperature, topP }
}

export async function generateAnswer(opts: {
    model: string
    system: string
    prompt: string
    temperature: number
    topP: number
    maxOutputTokens: number
}): Promise<GenerateResult> {
    const result = await withRetry(() => generateText({
        model: gatewayChatModel(opts.model),
        system: opts.system,
        prompt: opts.prompt,
        ...samplingParams(opts.temperature, opts.topP),
        maxOutputTokens: opts.maxOutputTokens,
    }))

    return {
        text: result.text,
        finishReason: result.finishReason ?? null,
        // Not every gateway reports usage, and a missing count is not a zero: reporting 0 tokens
        // would understate the cost of exactly the models that hide it.
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
    }
}
