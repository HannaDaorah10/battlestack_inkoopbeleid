import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyStepItems } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { requirePolicy, requireVeld, sjabloonSleutels } from '#server/utils/inkoopbeleid/werkroute'

const schema = z.object({
    itemId: z.uuid(),
    title: z.string().max(300).optional(),
    /** Sectiesleutel van het richtvragen-sjabloon naar de notitie van de adviseur. */
    answers: z.record(z.string(), z.string().max(50_000)).optional(),
})

/**
 * Een gespreksverslag bijwerken: wie er gesproken is, en de notities per thema.
 *
 * Twee dingen worden hier bewust dichtgetimmerd:
 *
 * 1. Het item moet bij dit inkoopbeleid horen. De id staat in de body, dus zonder deze controle
 *    zou iemand met een geldige sessie een gespreksverslag van een ander beleid, en dus mogelijk
 *    van een andere organisatie, kunnen overschrijven.
 * 2. Alleen sleutels die het sjabloon kent blijven staan. `answers` is jsonb, dus zonder filter
 *    is het een open opslagplek waar willekeurige inhoud in past die daarna nooit meer op een
 *    scherm langskomt.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    if (body.title === undefined && body.answers === undefined) {
        throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
    }

    await requirePolicy(id)

    const [item] = await db
        .select()
        .from(policyStepItems)
        .where(and(eq(policyStepItems.id, body.itemId), eq(policyStepItems.policyId, id)))
        .limit(1)

    if (!item) {
        throw createError({ statusCode: 404, statusMessage: 'Item not found' })
    }

    const veld = requireVeld(item.stepKey, item.fieldKey)

    let answers: Record<string, string> | undefined
    if (body.answers) {
        const toegestaan = sjabloonSleutels(veld)
        // Samenvoegen met wat er al staat, niet vervangen: de client bewaart per themaveld, dus
        // een volledige vervanging zou de andere thema's van hetzelfde gesprek wissen.
        answers = { ...item.answers }
        for (const [key, waarde] of Object.entries(body.answers)) {
            if (toegestaan.has(key)) answers[key] = waarde
        }
    }

    const [updated] = await db
        .update(policyStepItems)
        .set({
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(answers !== undefined ? { answers } : {}),
            updatedAt: new Date(),
        })
        .where(eq(policyStepItems.id, item.id))
        .returning()

    return updated
})
