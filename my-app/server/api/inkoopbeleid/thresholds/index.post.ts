import { z } from 'zod'
import { db } from '#server/database/client'
import {
    ExtraRequirement,
    PurchaseProcedure,
    PurchaseType,
    ThresholdRuleSet,
    thresholds,
} from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { tryLogAudit } from '#server/utils/audit-bridge'

const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

const schema = z.object({
    organisationId: z.uuid(),
    ruleSet: z.enum(ThresholdRuleSet).default(ThresholdRuleSet.Current),
    purchaseType: z.enum(PurchaseType),
    minAmountCents: cents,
    /** `null` = geen bovengrens (de hoogste categorie). Anders exclusief, zoals in de tabel. */
    maxAmountCents: cents.nullable(),
    procedure: z.enum(PurchaseProcedure),
    minQuotes: z.number().int().min(1).max(50),
    extraRequirement: z.enum(ExtraRequirement),
    advisorRequired: z.boolean().default(false),
}).refine((b) => b.maxAmountCents === null || b.maxAmountCents > b.minAmountCents, {
    message: 'Het bedrag "tot" moet hoger zijn dan het bedrag "vanaf".',
    path: ['maxAmountCents'],
})

/**
 * Een drempelcategorie vastleggen voor een organisatie.
 *
 * Tot nu toe kwamen drempels alleen uit de seed, waardoor een nieuwe organisatie nooit op
 * "Drempelbedragen vastgelegd" kon komen en Toets een inkoop voor haar geen uitkomst gaf.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    const [created] = await db.insert(thresholds).values(body).returning()
    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to record threshold' })
    }

    await tryLogAudit(event, 'inkoopbeleid.threshold.created', user.id, {
        thresholdId: created.id,
        organisationId: body.organisationId,
    })
    return created
})
