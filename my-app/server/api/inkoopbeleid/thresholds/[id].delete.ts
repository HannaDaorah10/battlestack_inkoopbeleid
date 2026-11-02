import { eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { thresholds } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'

/** Een drempelcategorie verwijderen. */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')

    const [deleted] = await db
        .delete(thresholds)
        .where(eq(thresholds.id, id))
        .returning({ id: thresholds.id, organisationId: thresholds.organisationId })
    if (!deleted) {
        throw createError({ statusCode: 404, statusMessage: 'Threshold not found' })
    }

    await tryLogAudit(event, 'inkoopbeleid.threshold.deleted', user.id, {
        thresholdId: id,
        organisationId: deleted.organisationId,
    })
    return { id: deleted.id }
})
