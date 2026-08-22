import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies, policyDeviations, PurchaseType } from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    organisationId: z.uuid(),
    policyId: z.uuid().nullish(),
    subject: z.string().min(1).max(300).trim(),
    amountCents: z.number().int().min(0).nullish(),
    purchaseType: z.enum(PurchaseType).nullish(),
    ruleSkipped: z.string().min(1).max(500).trim(),
    // The justification is the entire mechanism of "pas toe of leg uit", so it is required
    // here, and independently enforced by a CHECK constraint in the database.
    justification: z.string().min(20).max(4000).trim(),
    approverRole: z.string().max(200).trim().default(''),
})

/**
 * Record a "pas toe of leg uit" deviation: a rule was not followed, and here is why.
 *
 * The 20-character floor on `justification` is a deliberate friction. A one-word reason
 * ("urgent") satisfies a `notNull` column while explaining nothing, and comply-or-explain that
 * accepts a non-explanation is just comply-or-don't.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    if (body.policyId) {
        const [policy] = await db
            .select({ organisationId: policies.organisationId })
            .from(policies)
            .where(eq(policies.id, body.policyId))
            .limit(1)
        if (!policy) {
            throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
        }
        if (policy.organisationId !== body.organisationId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Policy belongs to a different organisation',
            })
        }
    }

    const [created] = await db
        .insert(policyDeviations)
        .values({
            organisationId: body.organisationId,
            policyId: body.policyId ?? null,
            subject: body.subject,
            amountCents: body.amountCents ?? null,
            purchaseType: body.purchaseType ?? null,
            ruleSkipped: body.ruleSkipped,
            justification: body.justification,
            createdByUserId: user.id,
            approverRole: body.approverRole,
        })
        .returning()

    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to record deviation' })
    }

    await tryLogAudit(event, 'inkoopbeleid.deviation.recorded', user.id, {
        deviationId: created.id,
        organisationId: body.organisationId,
        ruleSkipped: body.ruleSkipped,
    })

    return created
})
