import { asc, count, eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import {
    mandates,
    policies,
    policyChapters,
    policyGoals,
    thresholds,
} from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import {
    allowedTransitions,
    assessCompleteness,
    todayIsoDate,
} from '#server/utils/inkoopbeleid/workflow'

/**
 * One policy with everything the detail page renders: chapters, goals, the legal next steps,
 * and the completeness signal.
 *
 * Assembled server-side in one round trip rather than left to four client fetches, because the
 * completeness signal spans the policy AND its organisation's rule tables; computing it in the
 * browser would mean shipping every threshold and mandate row just to count them.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')

    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1)
    if (!policy) {
        throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
    }

    const [chapters, goals, thresholdCount, mandateCount] = await Promise.all([
        db
            .select()
            .from(policyChapters)
            .where(eq(policyChapters.policyId, id))
            .orderBy(asc(policyChapters.number)),
        db
            .select()
            .from(policyGoals)
            .where(eq(policyGoals.policyId, id))
            .orderBy(asc(policyGoals.sortOrder)),
        db
            .select({ n: count() })
            .from(thresholds)
            .where(eq(thresholds.organisationId, policy.organisationId)),
        db
            .select({ n: count() })
            .from(mandates)
            .where(eq(mandates.organisationId, policy.organisationId)),
    ])

    const completeness = assessCompleteness({
        chapters,
        goalCount: goals.length,
        thresholdCount: thresholdCount[0]?.n ?? 0,
        mandateCount: mandateCount[0]?.n ?? 0,
        periodStart: policy.periodStart,
        periodEnd: policy.periodEnd,
        today: todayIsoDate(),
    })

    return {
        policy,
        chapters,
        goals,
        completeness,
        allowedTransitions: allowedTransitions(policy.status),
    }
})
