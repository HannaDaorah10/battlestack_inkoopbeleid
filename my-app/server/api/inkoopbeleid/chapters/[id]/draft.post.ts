import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies, policyChapters, policyGoals } from '#server/database/schema/inkoopbeleid'
import { mastra } from '#server/mastra'
import { requireUuidRouterParam } from '#server/utils/auth'
import {
    NO_CONTEXT_NOTICE,
    assertGatewayConfigured,
    retrieveContext,
} from '#server/utils/inkoopbeleid/advisor'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    /**
     * Whether to write the draft into the chapter. Default false: an author should see a draft
     * before it replaces work they may already have written.
     */
    save: z.boolean().default(false),
})

/**
 * "Laat de adviseur dit hoofdstuk schrijven."
 *
 * Same retrieve-then-generate shape as the advisor, but the retrieval query is built from the
 * chapter itself and the agent is asked for a chapter rather than an answer.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    const [row] = await db
        .select({
            chapterId: policyChapters.id,
            number: policyChapters.number,
            key: policyChapters.key,
            title: policyChapters.title,
            contentMarkdown: policyChapters.contentMarkdown,
            policyId: policies.id,
            policyTitle: policies.title,
            organisationId: policies.organisationId,
        })
        .from(policyChapters)
        .innerJoin(policies, eq(policyChapters.policyId, policies.id))
        .where(eq(policyChapters.id, id))
        .limit(1)

    if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Chapter not found' })
    }

    assertGatewayConfigured()

    const goals = await db
        .select({ name: policyGoals.name, description: policyGoals.description })
        .from(policyGoals)
        .where(eq(policyGoals.policyId, row.policyId))

    // Retrieve on the chapter's subject, not on a generic query: a search for "Procedures,
    // drempelbedragen en werkwijze" pulls the tier tables, where a search for the policy title
    // would pull the cover page from every document equally.
    const { sources, contextBlock } = await retrieveContext({
        organisationId: row.organisationId,
        question: row.title,
        topK: 8,
    })

    const prompt = [
        'Context:',
        contextBlock || NO_CONTEXT_NOTICE,
        '',
        `Beleidsdocument: ${row.policyTitle}`,
        `Hoofdstuk ${row.number}: ${row.title}`,
        goals.length > 0
            ? `Inkoopdoelen van deze organisatie: ${goals.map((g) => g.name).join(', ')}`
            : 'Deze organisatie heeft nog geen inkoopdoelen vastgelegd.',
        '',
        `Schrijf de tekst van hoofdstuk ${row.number} (${row.title}).`,
    ].join('\n')

    const agent = mastra.getAgent('inkoopbeleid-redacteur')
    const result = await agent.generate(prompt)

    if (body.save) {
        await db
            .update(policyChapters)
            .set({ contentMarkdown: result.text, updatedAt: new Date() })
            .where(eq(policyChapters.id, id))
    }

    await tryLogAudit(event, 'inkoopbeleid.chapter.drafted', user.id, {
        chapterId: id,
        policyId: row.policyId,
        chapterKey: row.key,
        saved: body.save,
        sourceCount: sources.length,
    })

    return {
        draft: result.text,
        saved: body.save,
        sources: sources.map((s) => ({ title: s.title, source: s.source, score: s.score })),
        grounded: sources.length > 0,
    }
})
