import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies, PolicyStatus } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { canTransition, isRevision } from '#server/utils/inkoopbeleid/workflow'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    status: z.enum(PolicyStatus),
})

/**
 * Move a policy to the next workflow step.
 *
 * The transition is validated INSIDE the same UPDATE that performs it (`where id = ? and
 * status = ?`), not by a read-then-write. Two reviewers clicking "Vaststellen" and "Terug naar
 * opstellen" at the same moment would both pass a prior read of `bespreken`, and the second
 * write would silently overwrite the first. Matching on the expected current status makes the
 * loser's update affect zero rows, so it can be reported as a conflict instead of vanishing.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const { status } = await readValidatedBody(event, schema.parse)

    const [current] = await db
        .select({ status: policies.status, version: policies.version })
        .from(policies)
        .where(eq(policies.id, id))
        .limit(1)
    if (!current) {
        throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
    }

    if (current.status === status) return { id, status, version: current.version }

    if (!canTransition(current.status, status)) {
        throw createError({
            statusCode: 409,
            statusMessage: `Cannot move a policy from ${current.status} to ${status}`,
        })
    }

    // Reopening an adopted policy starts a new revision, so the adopted text and the text being
    // rewritten are never mistaken for the same version.
    const bumpVersion = isRevision(current.status, status)

    const [updated] = await db
        .update(policies)
        .set({
            status,
            version: bumpVersion ? sql`${policies.version} + 1` : undefined,
            updatedAt: new Date(),
        })
        .where(sql`${policies.id} = ${id} and ${policies.status} = ${current.status}`)
        .returning({
            id: policies.id,
            status: policies.status,
            version: policies.version,
        })

    if (!updated) {
        throw createError({
            statusCode: 409,
            statusMessage: 'Policy status changed in another request, reload and try again',
        })
    }

    await tryLogAudit(event, 'inkoopbeleid.policy.status.changed', user.id, {
        policyId: id,
        from: current.status,
        to: status,
        version: updated.version,
    })

    return updated
})
