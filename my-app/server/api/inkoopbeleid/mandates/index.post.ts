import { z } from 'zod'
import { db } from '#server/database/client'
import { mandates } from '#server/database/schema/inkoopbeleid'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    organisationId: z.uuid(),
    roleName: z.string().min(1).max(200).trim(),
    department: z.string().max(200).trim().default(''),
    ceilingAmountCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    scope: z.string().max(500).trim().default(''),
})

/**
 * Een mandaat (tekenbevoegdheid) vastleggen voor een organisatie. Zie de drempel-variant
 * (`thresholds/index.post.ts`) voor waarom dit scherm er moest komen.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    const [created] = await db.insert(mandates).values(body).returning()
    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to record mandate' })
    }

    await tryLogAudit(event, 'inkoopbeleid.mandate.created', user.id, {
        mandateId: created.id,
        organisationId: body.organisationId,
    })
    return created
})
