import { eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { policyGoals } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'

/** Remove a procurement goal. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')

    const [deleted] = await db
        .delete(policyGoals)
        .where(eq(policyGoals.id, id))
        .returning({ id: policyGoals.id })

    if (!deleted) {
        throw createError({ statusCode: 404, statusMessage: 'Goal not found' })
    }
    return { id: deleted.id }
})
