import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '#server/database/client'
import { aiModelConfigs } from '#server/database/schema/ai'
import { Role } from '#server/database/schema/users'
import { requireRole, requireRouterParam } from '#server/utils/auth'
import { tryLogAudit } from '#server/utils/audit-bridge'
import { invalidateActiveModel } from '#server/mastra/utils/ai-model'
import { probeEmbeddingModel } from '#server/utils/rag'

const schema = z.object({
    model: z.string().min(1, 'Model is required').max(200),
})

export default defineEventHandler(async (event) => {
    await requireRole(event, Role.Admin)

    const id = requireRouterParam(event, 'id')

    const { model } = await readValidatedBody(event, schema.parse)

    const [existing] = await db
        .select({ key: aiModelConfigs.key })
        .from(aiModelConfigs)
        .where(eq(aiModelConfigs.id, id))
        .limit(1)
    if (!existing) {
        throw createError({ statusCode: 404, statusMessage: 'Model config not found' })
    }

    // The vector index has a fixed width. An embedding model with a different width would make
    // every later document upload and every search fail, so the switch is refused up front with
    // the reason, rather than accepted and discovered by an end user.
    if (existing.key === 'embedding') {
        let probe: { dimensions: number, expected: number }
        try {
            probe = await probeEmbeddingModel(model)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            throw createError({
                statusCode: 422,
                statusMessage: `Het embeddingmodel "${model}" kon niet worden getest: ${message}`,
                data: { code: 'embedding-probe-failed' },
            })
        }
        if (probe.dimensions !== probe.expected) {
            throw createError({
                statusCode: 409,
                statusMessage:
                    `Het embeddingmodel "${model}" levert ${probe.dimensions} dimensies, maar de zoekindex `
                    + `verwacht er ${probe.expected}. Kies een model met ${probe.expected} dimensies, of bouw `
                    + 'eerst de index opnieuw op (NUXT_RAG_EMBEDDING_DIMENSIONS aanpassen en alle documenten opnieuw inlezen).',
                data: { code: 'embedding-dimension-mismatch', expected: probe.expected, got: probe.dimensions },
            })
        }
    }

    const [updated] = await db

        .update(aiModelConfigs)
        .set({ model, updatedAt: new Date() })
        .where(eq(aiModelConfigs.id, id))
        .returning({
            id: aiModelConfigs.id,
            key: aiModelConfigs.key,
            name: aiModelConfigs.name,
            description: aiModelConfigs.description,
            model: aiModelConfigs.model,
        })

    if (!updated) {
        throw createError({ statusCode: 404, statusMessage: 'Model config not found' })
    }

    // Drop the in-process cache so subsequent agent calls pick up the new model.
    invalidateActiveModel(updated.key as 'chat' | 'embedding')

    await tryLogAudit(event, 'ai.model-config.updated', null, {
        configId: updated.id,
        key: updated.key,
        model: updated.model,
    })

    return updated
})
