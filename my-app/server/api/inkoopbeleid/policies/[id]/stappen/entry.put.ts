import { z } from 'zod'
import { db } from '#server/database/client'
import { policyStepEntries } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { requirePolicy, requireVeld } from '#server/utils/inkoopbeleid/werkroute'

const schema = z.object({
    stepKey: z.string().min(1).max(100),
    fieldKey: z.string().min(1).max(100),
    content: z.string().max(100_000),
})

/**
 * Een onderdeel van een stapdocument bewaren.
 *
 * Upsert op (policy, stap, onderdeel), want een onderdeel heeft precies een tekst. De client
 * bewaart bij het verlaten van een werkscherm, dus twee schermen snel achter elkaar mogen nooit
 * twee rijen opleveren; dat regelt de unieke sleutel in het schema, niet een controle hier die
 * een race kan verliezen.
 *
 * Geen auditregel per opslag: dit is autosave-frequentie, en een audittrail die volloopt met
 * "iemand typte in een tekstvak" verbergt juist de gebeurtenissen die er wel toe doen, zoals
 * een statuswijziging of een vastgestelde afwijking.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    await requirePolicy(id)
    requireVeld(body.stepKey, body.fieldKey)

    const now = new Date()
    const [saved] = await db
        .insert(policyStepEntries)
        .values({
            policyId: id,
            stepKey: body.stepKey,
            fieldKey: body.fieldKey,
            content: body.content,
        })
        .onConflictDoUpdate({
            target: [
                policyStepEntries.policyId,
                policyStepEntries.stepKey,
                policyStepEntries.fieldKey,
            ],
            set: { content: body.content, updatedAt: now },
        })
        .returning({
            stepKey: policyStepEntries.stepKey,
            fieldKey: policyStepEntries.fieldKey,
            content: policyStepEntries.content,
            updatedAt: policyStepEntries.updatedAt,
        })

    return saved
})
