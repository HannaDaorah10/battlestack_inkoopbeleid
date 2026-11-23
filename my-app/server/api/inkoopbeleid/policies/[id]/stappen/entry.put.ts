import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyStepEntries } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { requirePolicy, requireVeld } from '#server/utils/inkoopbeleid/werkroute'
import { schrijfOnderdeelNaarHoofdstuk } from '#server/utils/inkoopbeleid/route-hoofdstukken'

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
    const veld = requireVeld(body.stepKey, body.fieldKey)

    const now = new Date()
    // In een transactie met de hoofdstuk-sync: de vorige tekst is wat bepaalt of het hoofdstuk
    // nog een ongewijzigde kopie is, dus lezen, schrijven en doorzetten horen bij elkaar.
    const saved = await db.transaction(async (tx) => {
        const [vorige] = await tx
            .select({ content: policyStepEntries.content })
            .from(policyStepEntries)
            .where(and(
                eq(policyStepEntries.policyId, id),
                eq(policyStepEntries.stepKey, body.stepKey),
                eq(policyStepEntries.fieldKey, body.fieldKey),
            ))
            .limit(1)

        const [rij] = await tx
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

        if (veld.hoofdstuk) {
            await schrijfOnderdeelNaarHoofdstuk(tx, {
                policyId: id,
                chapterKey: veld.hoofdstuk,
                vorigeInhoud: vorige?.content ?? '',
                nieuweInhoud: body.content,
            })
        }
        return rij
    })

    return saved
})
