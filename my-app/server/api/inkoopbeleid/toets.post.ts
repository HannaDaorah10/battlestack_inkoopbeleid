import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import {
    mandates,
    PurchaseType,
    ThresholdRuleSet,
    thresholds,
} from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { Recurrence, evaluatePurchase } from '#server/utils/inkoopbeleid/thresholds'

const schema = z.object({
    organisationId: z.uuid(),
    /**
     * Cents, integer. Cents rather than euros in the API too: accepting a decimal here would
     * put a float back into a money path the database went out of its way to keep integral.
     */
    amountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    purchaseType: z.enum(PurchaseType),
    recurrence: z.enum(Recurrence).default(Recurrence.Once),
    durationYears: z.number().int().min(0).max(50).default(1),
    ruleSet: z.enum(ThresholdRuleSet).default(ThresholdRuleSet.Current),
})

/**
 * "Ik wil X kopen voor Y euro" - which procedure, how many quotes, what paperwork, who signs.
 *
 * A thin shell on purpose: load the organisation's rows, hand them to the pure rule engine,
 * return the verdict. Every rule that decides anything lives in
 * `server/utils/inkoopbeleid/thresholds.ts`, where it is tested without a database.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    const [thresholdRows, mandateRows] = await Promise.all([
        db
            .select()
            .from(thresholds)
            .where(eq(thresholds.organisationId, body.organisationId))
            .orderBy(desc(thresholds.minAmountCents)),
        db
            .select()
            .from(mandates)
            .where(eq(mandates.organisationId, body.organisationId))
            .orderBy(asc(mandates.ceilingAmountCents)),
    ])

    return evaluatePurchase({
        amountCents: body.amountCents,
        purchaseType: body.purchaseType,
        recurrence: body.recurrence,
        durationYears: body.durationYears,
        ruleSet: body.ruleSet,
        thresholds: thresholdRows,
        mandates: mandateRows,
    })
})
