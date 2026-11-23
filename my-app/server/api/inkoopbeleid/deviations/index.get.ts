import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyDeviations } from '#server/database/schema/inkoopbeleid'
import { users } from '#server/database/schema/users'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'

const schema = z.object({
    organisationId: z.uuid(),
})

/** Recorded deviations for one organisation, newest first. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const { organisationId } = await getValidatedQuery(event, schema.parse)
    await requireOrganisation(organisationId)

    return db
        .select({
            id: policyDeviations.id,
            subject: policyDeviations.subject,
            amountCents: policyDeviations.amountCents,
            purchaseType: policyDeviations.purchaseType,
            ruleSkipped: policyDeviations.ruleSkipped,
            justification: policyDeviations.justification,
            approverRole: policyDeviations.approverRole,
            approvedAt: policyDeviations.approvedAt,
            createdAt: policyDeviations.createdAt,
            recordedByName: users.name,
            recordedByEmail: users.email,
        })
        .from(policyDeviations)
        .leftJoin(users, eq(policyDeviations.createdByUserId, users.id))
        .where(eq(policyDeviations.organisationId, organisationId))
        .orderBy(desc(policyDeviations.createdAt))
})
