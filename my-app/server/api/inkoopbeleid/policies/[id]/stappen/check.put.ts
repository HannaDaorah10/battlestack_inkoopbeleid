import { z } from 'zod'
import { db } from '#server/database/client'
import { StepCheckKind, policyStepChecks } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import {
    checklistLengte,
    requirePolicy,
    requireStap,
} from '#server/utils/inkoopbeleid/werkroute'

const schema = z.object({
    stepKey: z.string().min(1).max(100),
    checkKind: z.enum(StepCheckKind),
    itemIndex: z.number().int().min(0),
    checked: z.boolean(),
})

/**
 * Een vinkje zetten of weghalen op de checklist "Input verzamelen" of "Controleer jezelf".
 *
 * `itemIndex` wordt tegen de lengte van de echte checklist gehouden. Een index buiten bereik is
 * geen onschuldige rij: hij zou meetellen in "3 van de 5 afgevinkt" terwijl er geen vijfde vraag
 * bestaat, en dat is precies het getal waarop een adviseur afgaat om een stap af te ronden.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    await requirePolicy(id)
    const stap = requireStap(body.stepKey)

    const lengte = checklistLengte(stap, body.checkKind)
    if (body.itemIndex >= lengte) {
        throw createError({
            statusCode: 400,
            statusMessage: `itemIndex ${body.itemIndex} is out of range for ${body.stepKey}/${body.checkKind} (${lengte} items)`,
        })
    }

    const [saved] = await db
        .insert(policyStepChecks)
        .values({
            policyId: id,
            stepKey: body.stepKey,
            checkKind: body.checkKind,
            itemIndex: body.itemIndex,
            checked: body.checked,
        })
        .onConflictDoUpdate({
            target: [
                policyStepChecks.policyId,
                policyStepChecks.stepKey,
                policyStepChecks.checkKind,
                policyStepChecks.itemIndex,
            ],
            set: { checked: body.checked, updatedAt: new Date() },
        })
        .returning({
            stepKey: policyStepChecks.stepKey,
            checkKind: policyStepChecks.checkKind,
            itemIndex: policyStepChecks.itemIndex,
            checked: policyStepChecks.checked,
        })

    return saved
})
