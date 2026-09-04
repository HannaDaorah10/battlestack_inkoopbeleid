/**
 * The prompt-shaping half of the digitale adviseur: excerpts in, a prompt string out.
 *
 * Split off from `advisor.ts` because everything here is pure. `advisor.ts` reaches the vector
 * index through `utils/rag`, which imports `mastra/utils/ai-model`, which imports the database
 * client — so importing it costs a database connection. The evaluation harness in `tools/eval`
 * must run with no database at all, and it has to build byte-identical prompts to the ones the
 * API route sends, or a sweep tunes something the app never asks.
 *
 * Nitro auto-imports every symbol under `server/utils/`, so these are deliberately NOT re-exported
 * from `advisor.ts`: two modules exporting the same name would collide in the generated imports.
 */

export interface RetrievedSource {
    title: string
    source: string
    score: number
    text: string
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

/**
 * The advisor's user message: retrieved context, then the question.
 *
 * An empty `contextBlock` becomes {@link NO_CONTEXT_NOTICE} rather than short-circuiting the call.
 * The agent is instructed to say plainly that the documents do not cover this, which is a more
 * useful reply than a bare empty-result state, and it keeps "I don't know" a normal answer instead
 * of an error.
 */
export function buildAdvicePrompt(input: { contextBlock: string, question: string }): string {
    return [
        'Context:',
        input.contextBlock || NO_CONTEXT_NOTICE,
        '',
        `Vraag: ${input.question}`,
    ].join('\n')
}
