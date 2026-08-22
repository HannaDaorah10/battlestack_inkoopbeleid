import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { mandates, thresholds } from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'

const schema = z.object({
    organisationId: z.uuid(),
})

/**
 * The organisation's rule tables: threshold tiers and signing mandates.
 *
 * Returned together in one call because the checker page shows both next to the verdict, and
 * they are meaningless apart - a tier tells you how to buy, a mandate tells you who may sign.
 * Kept as two arrays rather than merged, mirroring the two separate tables.
 */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const { organisationId } = await getValidatedQuery(event, schema.parse)
    await requireOrganisation(organisationId)

    const [thresholdRows, mandateRows] = await Promise.all([
        db
            .select()
            .from(thresholds)
            .where(eq(thresholds.organisationId, organisationId))
            .orderBy(asc(thresholds.purchaseType), desc(thresholds.minAmountCents)),
        db
            .select()
            .from(mandates)
            .where(eq(mandates.organisationId, organisationId))
            .orderBy(desc(mandates.ceilingAmountCents)),
    ])

    return { thresholds: thresholdRows, mandates: mandateRows }
})
