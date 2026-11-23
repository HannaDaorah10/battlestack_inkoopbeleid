import { desc, eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { policyChapters, policyReviews } from '#server/database/schema/inkoopbeleid'
import { users } from '#server/database/schema/users'
import { requireUuidRouterParam } from '#server/utils/auth'

/** Review thread for a policy, newest first, with author and chapter resolved for display. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')

    return db
        .select({
            id: policyReviews.id,
            chapterId: policyReviews.chapterId,
            chapterNumber: policyChapters.number,
            chapterTitle: policyChapters.title,
            comment: policyReviews.comment,
            decision: policyReviews.decision,
            createdAt: policyReviews.createdAt,
            // Null once the account is deleted: `policy_reviews.user_id` is `set null` so the
            // record of the decision outlives the person who made it.
            authorName: users.name,
            authorEmail: users.email,
        })
        .from(policyReviews)
        .leftJoin(users, eq(policyReviews.userId, users.id))
        .leftJoin(policyChapters, eq(policyReviews.chapterId, policyChapters.id))
        .where(eq(policyReviews.policyId, id))
        .orderBy(desc(policyReviews.createdAt))
})
