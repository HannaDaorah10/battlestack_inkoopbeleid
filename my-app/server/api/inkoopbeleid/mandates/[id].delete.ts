import { eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { mandates } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'

/** Een mandaat verwijderen. */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')

    const [deleted] = await db
        .delete(mandates)
        .where(eq(mandates.id, id))
        .returning({ id: mandates.id, organisationId: mandates.organisationId })
    if (!deleted) {
        throw createError({ statusCode: 404, statusMessage: 'Mandate not found' })
    }

    await tryLogAudit(event, 'inkoopbeleid.mandate.deleted', user.id, {
        mandateId: id,
        organisationId: deleted.organisationId,
    })
    return { id: deleted.id }
})
