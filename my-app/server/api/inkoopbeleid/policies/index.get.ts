import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies } from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'

const schema = z.object({
    organisationId: z.uuid(),
})

/** Policies belonging to one organisation, newest first. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const { organisationId } = await getValidatedQuery(event, schema.parse)
    await requireOrganisation(organisationId)

    return db
        .select({
            id: policies.id,
            title: policies.title,
            status: policies.status,
            version: policies.version,
            periodStart: policies.periodStart,
            periodEnd: policies.periodEnd,
            updatedAt: policies.updatedAt,
        })
        .from(policies)
        .where(eq(policies.organisationId, organisationId))
        .orderBy(desc(policies.updatedAt))
})
