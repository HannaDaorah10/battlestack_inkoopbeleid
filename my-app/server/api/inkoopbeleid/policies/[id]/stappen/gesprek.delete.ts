import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyStepItems } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'
import { requirePolicy } from '#server/utils/inkoopbeleid/werkroute'

const schema = z.object({
    itemId: z.uuid(),
})

/**
 * Een gespreksverslag verwijderen.
 *
 * De `policyId` staat in de WHERE en niet alleen in een controle vooraf: dat maakt van "hoort dit
 * item bij dit beleid" een eigenschap van de verwijdering zelf, in plaats van een losse check die
 * een latere refactor per ongeluk kan weglaten.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    await requirePolicy(id)

    const [deleted] = await db
        .delete(policyStepItems)
        .where(and(eq(policyStepItems.id, body.itemId), eq(policyStepItems.policyId, id)))
        .returning()

    if (!deleted) {
        throw createError({ statusCode: 404, statusMessage: 'Item not found' })
    }

    await tryLogAudit(event, 'inkoopbeleid.stap.gesprek.deleted', user.id, {
        policyId: id,
        stepKey: deleted.stepKey,
        fieldKey: deleted.fieldKey,
        itemId: deleted.id,
    })

    return { id: deleted.id }
})
