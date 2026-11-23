import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policies } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    title: z.string().min(1).max(200).trim().optional(),
    // `YYYY-MM-DD` of null om de grens leeg te maken.
    periodStart: z.iso.date().nullable().optional(),
    periodEnd: z.iso.date().nullable().optional(),
})

/**
 * Titel en geldigheidsperiode van een beleid aanpassen.
 *
 * Een beleid dat via "Start de route" ontstaat heeft geen periode, en die kon daarna nergens meer
 * worden ingevuld. Daardoor bleef "Binnen de geldigheidsperiode" altijd open en kon de
 * volledigheidsscore nooit 100% worden.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    const [current] = await db
        .select({ periodStart: policies.periodStart, periodEnd: policies.periodEnd })
        .from(policies)
        .where(eq(policies.id, id))
        .limit(1)
    if (!current) {
        throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
    }

    const start = body.periodStart !== undefined ? body.periodStart : current.periodStart
    const end = body.periodEnd !== undefined ? body.periodEnd : current.periodEnd
    if (start && end && end < start) {
        throw createError({ statusCode: 400, statusMessage: 'De einddatum ligt voor de begindatum.' })
    }

    const [updated] = await db
        .update(policies)
        .set({
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.periodStart !== undefined ? { periodStart: body.periodStart } : {}),
            ...(body.periodEnd !== undefined ? { periodEnd: body.periodEnd } : {}),
            updatedAt: new Date(),
        })
        .where(eq(policies.id, id))
        .returning()

    await tryLogAudit(event, 'inkoopbeleid.policy.updated', user.id, {
        policyId: id,
        fields: Object.keys(body),
    })
    return updated
})
