import { asc, eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import {
    policyStepChecks,
    policyStepEntries,
    policyStepItems,
} from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { allowedTransitions } from '#server/utils/inkoopbeleid/workflow'
import { requirePolicy } from '#server/utils/inkoopbeleid/werkroute'

/**
 * Al het werk dat in de begeleide route van dit inkoopbeleid is gedaan.
 *
 * In een keer alles, niet per stap. De route is een doorlopende reis waarin de reisbalk links
 * de voortgang van alle stappen tegelijk toont en het afrondscherm van stap 1 al hoort te weten
 * of stap 3 gevuld is. Per stap ophalen zou bij elke schermwissel een fetch kosten voor data die
 * met vijf stappen sowieso in een handvol kilobytes past.
 *
 * De werkinstructie zelf zit er niet bij: die is statische content die de client al heeft via
 * `shared/werkinstructies/`. Hier gaat alleen wat de gebruiker heeft ingevuld over de lijn.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const policy = await requirePolicy(id)

    const [entries, checks, items] = await Promise.all([
        db
            .select({
                stepKey: policyStepEntries.stepKey,
                fieldKey: policyStepEntries.fieldKey,
                content: policyStepEntries.content,
                updatedAt: policyStepEntries.updatedAt,
            })
            .from(policyStepEntries)
            .where(eq(policyStepEntries.policyId, id)),
        db
            .select({
                stepKey: policyStepChecks.stepKey,
                checkKind: policyStepChecks.checkKind,
                itemIndex: policyStepChecks.itemIndex,
                checked: policyStepChecks.checked,
            })
            .from(policyStepChecks)
            .where(eq(policyStepChecks.policyId, id)),
        db
            .select()
            .from(policyStepItems)
            .where(eq(policyStepItems.policyId, id))
            .orderBy(asc(policyStepItems.sortOrder), asc(policyStepItems.createdAt)),
    ])

    return {
        policy: {
            id: policy.id,
            title: policy.title,
            status: policy.status,
            version: policy.version,
            organisationId: policy.organisationId,
        },
        // Meegestuurd zodat het afrondscherm van een stap kan aanbieden om het beleid naar de
        // volgende status te zetten, zonder tweede fetch en zonder de overgangsregels hier te
        // herhalen.
        allowedTransitions: allowedTransitions(policy.status),
        entries,
        // Alleen de aangevinkte items gaan mee. Niet-aangevinkt is de standaard aan beide
        // kanten, dus rijen met `checked: false` zeggen niets wat de client niet al aanneemt.
        checks: checks.filter((c) => c.checked),
        items,
    }
})
