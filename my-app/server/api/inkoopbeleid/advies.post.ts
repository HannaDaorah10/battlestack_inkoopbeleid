import { z } from 'zod'
import { mastra } from '#server/mastra'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import {
    NO_CONTEXT_NOTICE,
    assertGatewayConfigured,
    retrieveContext,
} from '#server/utils/inkoopbeleid/advisor'

const schema = z.object({
    organisationId: z.uuid(),
    question: z.string().min(3).max(2000).trim(),
    topK: z.number().int().min(1).max(20).optional(),
})

/**
 * The digitale adviseur: retrieve, then generate.
 *
 * Returns the sources alongside the answer, always. An ungrounded procurement answer that
 * sounds right is worse than no answer, so the reader is given the excerpts the model saw and
 * can check the claim against the policy themselves.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    assertGatewayConfigured()

    const { sources, contextBlock } = await retrieveContext({
        organisationId: body.organisationId,
        question: body.question,
        topK: body.topK,
    })

    // Answer even with no context, rather than short-circuiting: the agent is instructed to say
    // plainly that the documents do not cover this, which is a more useful reply than a bare
    // empty-result state, and it keeps "I don't know" a normal answer instead of an error.
    const prompt = [
        'Context:',
        contextBlock || NO_CONTEXT_NOTICE,
        '',
        `Vraag: ${body.question}`,
    ].join('\n')

    const agent = mastra.getAgent('inkoopbeleid')
    const result = await agent.generate(prompt)

    return {
        answer: result.text,
        sources: sources.map((s) => ({ title: s.title, source: s.source, score: s.score })),
        // Surfaced so the UI can show "no documents matched" instead of implying the model
        // simply had nothing to say.
        grounded: sources.length > 0,
    }
})
