import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies, policyGoals } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'

const schema = z.object({
    name: z.string().min(1).max(120).trim(),
    description: z.string().max(1000).default(''),
})

/**
 * Add a procurement goal.
 *
 * This route is what makes "goals are editable per organisation" a fact rather than a claim:
 * without it the seeded lists would be a hardcoded enum wearing a table's clothes.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
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

    // Append to the end. Computed in SQL rather than from a previous SELECT so two concurrent
    // adds cannot both read the same max and collide on sort order.
    const [created] = await db
        .insert(policyGoals)
        .values({
            policyId,
            name: body.name,
            description: body.description,
            sortOrder: sql`(select coalesce(max(${policyGoals.sortOrder}), -1) + 1 from ${policyGoals} where ${policyGoals.policyId} = ${policyId})`,
        })
        .returning()

    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to create goal' })
    }
    return created
})
