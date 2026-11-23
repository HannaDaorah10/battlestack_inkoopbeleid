import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import {
    policies,
    policyChapters,
    policyReviews,
    ReviewDecision,
} from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    chapterId: z.uuid().nullish(),
    comment: z.string().max(4000).default(''),
    decision: z.enum(ReviewDecision).default(ReviewDecision.Comment),
})

/**
 * Leave a comment, approval or rejection on a policy or one of its chapters.
 *
 * A plain comment with no text is rejected: an empty row in a review thread is noise that
 * looks like participation. An approve/reject may be wordless, because the decision itself
 * carries the meaning.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const policyId = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    const [policy] = await db
        .select({ id: policies.id })
        .from(policies)
        .where(eq(policies.id, policyId))
        .limit(1)
    if (!policy) {
        throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
    }

    if (body.decision === ReviewDecision.Comment && body.comment.trim().length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'A comment cannot be empty' })
    }

    if (body.chapterId) {
        // Scoped to this policy: an id from another policy's chapter would otherwise attach a
        // review to a document it does not belong to.
        const [chapter] = await db
            .select({ id: policyChapters.id })
            .from(policyChapters)
            .where(and(
                eq(policyChapters.id, body.chapterId),
                eq(policyChapters.policyId, policyId),
            ))
            .limit(1)
        if (!chapter) {
            throw createError({ statusCode: 404, statusMessage: 'Chapter not found in this policy' })
        }
    }

    const [created] = await db
        .insert(policyReviews)
        .values({
            policyId,
            chapterId: body.chapterId ?? null,
            userId: user.id,
            comment: body.comment.trim(),
            decision: body.decision,
        })
        .returning()

    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to record review' })
    }

    await tryLogAudit(event, 'inkoopbeleid.review.created', user.id, {
        policyId,
        chapterId: body.chapterId ?? null,
        decision: body.decision,
    })

    return created
})
