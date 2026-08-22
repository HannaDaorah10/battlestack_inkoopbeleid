import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { policyChapters } from '#server/database/schema/inkoopbeleid'
import { requireUuidRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    title: z.string().min(1).max(200).trim().optional(),
    contentMarkdown: z.string().max(200_000).optional(),
})

/** Save an edited chapter. */
export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event)
    const id = requireUuidRouterParam(event, 'id')
    const body = await readValidatedBody(event, schema.parse)

    if (body.title === undefined && body.contentMarkdown === undefined) {
        throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
    }

    const [updated] = await db
        .update(policyChapters)
        .set({
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.contentMarkdown !== undefined ? { contentMarkdown: body.contentMarkdown } : {}),
            updatedAt: new Date(),
        })
        .where(eq(policyChapters.id, id))
        .returning()

    if (!updated) {
        throw createError({ statusCode: 404, statusMessage: 'Chapter not found' })
    }

    await tryLogAudit(event, 'inkoopbeleid.chapter.updated', user.id, {
        chapterId: id,
        policyId: updated.policyId,
        chapterKey: updated.key,
    })

    return updated
})
