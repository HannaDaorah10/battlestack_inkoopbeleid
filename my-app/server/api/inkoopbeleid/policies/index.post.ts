import { z } from 'zod'
import { db } from '#server/database/client'
import { policies, policyChapters, PolicyStatus } from '#server/database/schema/inkoopbeleid'
import { POLICY_CHAPTER_TEMPLATE } from '#server/utils/inkoopbeleid/chapters'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    organisationId: z.uuid(),
    title: z.string().min(1).max(200).trim(),
    // `YYYY-MM-DD`, matching the `date` columns. Optional: a policy in the analysis step often
    // does not know its own validity period yet.
    periodStart: z.iso.date().nullish(),
    periodEnd: z.iso.date().nullish(),
})

/**
 * Create a policy, pre-filled with the fixed 10-chapter skeleton.
 *
 * The chapters are inserted in the same transaction as the policy: a policy row without its
 * chapters would render as an empty document that no UI offers a way to repair.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    await requireOrganisation(body.organisationId)

    if (body.periodStart && body.periodEnd && body.periodEnd < body.periodStart) {
        throw createError({ statusCode: 400, statusMessage: 'periodEnd must not precede periodStart' })
    }

    const created = await db.transaction(async (tx) => {
        const [policy] = await tx
            .insert(policies)
            .values({
                organisationId: body.organisationId,
                title: body.title,
                periodStart: body.periodStart ?? null,
                periodEnd: body.periodEnd ?? null,
                status: PolicyStatus.Analyse,
            })
            .returning({
                id: policies.id,
                title: policies.title,
                status: policies.status,
                version: policies.version,
            })
        if (!policy) {
            throw createError({ statusCode: 500, statusMessage: 'Failed to create policy' })
        }

        await tx.insert(policyChapters).values(
            POLICY_CHAPTER_TEMPLATE.map((c) => ({
                policyId: policy.id,
                number: c.number,
                key: c.key,
                title: c.title,
            })),
        )

        return policy
    })

    await tryLogAudit(event, 'inkoopbeleid.policy.created', user.id, {
        policyId: created.id,
        organisationId: body.organisationId,
    })

    return created
})
