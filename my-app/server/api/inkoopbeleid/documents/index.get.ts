import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyDocuments } from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'

const schema = z.object({
    organisationId: z.uuid(),
})

/** Documents ingested for one organisation, newest first. */
export default defineEventHandler(async (event) => {
    await requireUserSession(event)
    const { organisationId } = await getValidatedQuery(event, schema.parse)
    await requireOrganisation(organisationId)

    return db
        .select({
            id: policyDocuments.id,
            title: policyDocuments.title,
            sourceLabel: policyDocuments.sourceLabel,
            kind: policyDocuments.kind,
            chunkCount: policyDocuments.chunkCount,
            ingestedAt: policyDocuments.ingestedAt,
            policyId: policyDocuments.policyId,
            fileId: policyDocuments.fileId,
        })
        .from(policyDocuments)
        .where(eq(policyDocuments.organisationId, organisationId))
        .orderBy(desc(policyDocuments.ingestedAt))
})
