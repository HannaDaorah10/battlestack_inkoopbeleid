import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import {
    mandates,
    organisations,
    policies,
    policyChapters,
    policyGoals,
    thresholds,
} from '#server/database/schema/inkoopbeleid'
import { routeAntwoordenVoorHoofdstuk } from '#server/utils/inkoopbeleid/route-hoofdstukken'
import { mastra } from '#server/mastra'
import { requireUuidRouterParam } from '#server/utils/auth'
import {
    assertGatewayConfigured,
    retrieveContext,
} from '#server/utils/inkoopbeleid/advisor'
import { buildChapterDraftPrompt } from '#server/utils/inkoopbeleid/advice-prompt'
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
            organisationName: organisations.name,
        })
        .from(policyChapters)
        .innerJoin(policies, eq(policyChapters.policyId, policies.id))
        .innerJoin(organisations, eq(policies.organisationId, organisations.id))
        .where(eq(policyChapters.id, id))
        .limit(1)

    if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Chapter not found' })
    }

    assertGatewayConfigured()

    const [goals, thresholdRows, mandateRows, routeAntwoorden] = await Promise.all([
        db
            .select({ name: policyGoals.name, description: policyGoals.description })
            .from(policyGoals)
            .where(eq(policyGoals.policyId, row.policyId))
            .orderBy(asc(policyGoals.sortOrder)),
        db
            .select()
            .from(thresholds)
            .where(eq(thresholds.organisationId, row.organisationId))
            .orderBy(asc(thresholds.ruleSet), asc(thresholds.purchaseType), asc(thresholds.minAmountCents)),
        db
            .select()
            .from(mandates)
            .where(eq(mandates.organisationId, row.organisationId))
            .orderBy(desc(mandates.ceilingAmountCents)),
        routeAntwoordenVoorHoofdstuk(db, { policyId: row.policyId, chapterKey: row.key }),
    ])

    // Retrieve on the chapter's subject, not on a generic query: a search for "Procedures,
    // drempelbedragen en werkwijze" pulls the tier tables, where a search for the policy title
    // would pull the cover page from every document equally.
    const { sources, contextBlock } = await retrieveContext({
        organisationId: row.organisationId,
        question: row.title,
        topK: 8,
    })

    const prompt = buildChapterDraftPrompt({
        contextBlock,
        organisationName: row.organisationName,
        policyTitle: row.policyTitle,
        chapterNumber: row.number,
        chapterTitle: row.title,
        goals,
        thresholds: thresholdRows,
        mandates: mandateRows,
        routeAntwoorden,
    })

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
