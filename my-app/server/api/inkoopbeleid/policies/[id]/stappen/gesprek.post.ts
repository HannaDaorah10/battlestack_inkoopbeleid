import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyStepItems } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'
import { requireHerhaalbaarVeld, requirePolicy } from '#server/utils/inkoopbeleid/werkroute'

const schema = z.object({
    stepKey: z.string().min(1).max(100),
    fieldKey: z.string().min(1).max(100),
    title: z.string().max(300).trim().optional(),
})

/**
 * Een gespreksverslag toevoegen aan een herhaalbaar onderdeel (de stakeholdergesprekken van
 * stap 0.2.2 en 0.2.4).
 *
 * Het item begint leeg: het formulier eronder wordt gevuld door de gebruiker en per veld
 * bewaard via `gesprek.put`. Zo is "ik heb met deze persoon gesproken" al vastgelegd voordat
 * het verslag af is, wat overeenkomt met hoe de stap in de praktijk loopt.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    await requirePolicy(id)
    requireHerhaalbaarVeld(body.stepKey, body.fieldKey)

    // Achteraan in de lijst. In een subquery en niet als los `select` gevolgd door een insert,
    // zodat twee gelijktijdige toevoegingen niet dezelfde `sortOrder` krijgen.
    const volgendeSortOrder = sql<number>`(
        select coalesce(max(${policyStepItems.sortOrder}), -1) + 1
        from ${policyStepItems}
        where ${policyStepItems.policyId} = ${id}
          and ${policyStepItems.stepKey} = ${body.stepKey}
          and ${policyStepItems.fieldKey} = ${body.fieldKey}
    )`

    const [created] = await db
        .insert(policyStepItems)
        .values({
            policyId: id,
            stepKey: body.stepKey,
            fieldKey: body.fieldKey,
            title: body.title ?? '',
            answers: {},
            sortOrder: volgendeSortOrder,
        })
        .returning()

    await tryLogAudit(event, 'inkoopbeleid.stap.gesprek.created', user.id, {
        policyId: id,
        stepKey: body.stepKey,
        fieldKey: body.fieldKey,
        itemId: created?.id,
    })

    return created
})
