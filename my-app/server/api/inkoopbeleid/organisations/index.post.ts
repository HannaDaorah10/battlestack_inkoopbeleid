import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { organisations } from '#server/database/schema/inkoopbeleid'
import { slugify } from '#server/utils/inkoopbeleid/slug'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    name: z.string().trim().min(1).max(200),
})

const SELECT_FIELDS = {
    id: organisations.id,
    name: organisations.name,
    slug: organisations.slug,
}

/**
 * Find-or-create an organisation by name: the self-service replacement for hand-editing the
 * seed file. Matching is by slug, not the raw name, so "Welbions" and "welbions " land on the
 * same row instead of silently forking into two, which is what makes this safe to call every
 * time someone types their organisation's name rather than only on an explicit "create" click.
 */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const body = await readValidatedBody(event, schema.parse)
    const slug = slugify(body.name)

    const existing = await findBySlug(slug)
    if (existing) return existing

    try {
        const [created] = await db
            .insert(organisations)
            .values({ name: body.name, slug })
            .returning(SELECT_FIELDS)
        if (!created) {
            throw createError({ statusCode: 500, statusMessage: 'Failed to create organisation' })
        }

        await tryLogAudit(event, 'inkoopbeleid.organisation.created', user.id, {
            organisationId: created.id,
            name: created.name,
        })
        return created
    } catch (err) {
        // 23505 = unique_violation: a concurrent request created the same slug between our
        // check and this insert (TOCTOU). Not an error from the caller's point of view, since
        // typing your organisation's name should always land you on it: return that row instead.
        if ((err as { code?: string }).code === '23505') {
            const raced = await findBySlug(slug)
            if (raced) return raced
        }
        throw err
    }
})

async function findBySlug(slug: string) {
    const [org] = await db
        .select(SELECT_FIELDS)
        .from(organisations)
        .where(eq(organisations.slug, slug))
        .limit(1)
    return org ?? null
}
