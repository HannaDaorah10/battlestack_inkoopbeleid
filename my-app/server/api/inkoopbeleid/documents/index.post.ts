import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '#server/database/client'
import { files } from '#server/database/schema/files'
import {
    policies,
    policyDocuments,
    PolicyDocumentKind,
} from '#server/database/schema/inkoopbeleid'
import { getObjectBytes } from '#server/utils/storage'
import { ingestText } from '#server/utils/rag'
import {
    UnsupportedDocumentTypeError,
    extractDocumentText,
} from '#server/utils/inkoopbeleid/extract'
import { requireOrganisation } from '#server/utils/inkoopbeleid/organisation'
import { tryLogAudit } from '#server/utils/audit-bridge'

const schema = z.object({
    organisationId: z.uuid(),
    policyId: z.uuid().nullish(),
    /** From `POST /api/files`, which has already verified the object landed in the bucket. */
    fileId: z.uuid(),
    title: z.string().min(1).max(300).trim(),
    kind: z.enum(PolicyDocumentKind).default(PolicyDocumentKind.Referentie),
    sourceLabel: z.string().max(300).trim().optional(),
})

/**
 * Ingest an uploaded policy document: read it back from storage, extract its text, embed it,
 * and record what was ingested.
 *
 * The upload itself is NOT re-implemented here. The browser goes through the scaffold's
 * existing `POST /api/files/upload-url` then `POST /api/files`, and hands this route the
 * resulting `fileId`. One MIME allowlist, one upload path, one place that talks to S3.
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
        // A document filed under organisation A but attached to organisation B's policy would
        // be retrievable by neither consistently; refuse rather than silently pick one.
        if (policy.organisationId !== body.organisationId) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Policy belongs to a different organisation',
            })
        }
    }

    const [file] = await db
        .select({ key: files.key, mime: files.mime, size: files.size })
        .from(files)
        .where(eq(files.id, body.fileId))
        .limit(1)
    if (!file) {
        throw createError({ statusCode: 404, statusMessage: 'File not found' })
    }

    const bytes = await getObjectBytes(file.key)

    let extracted
    try {
        extracted = await extractDocumentText(bytes, file.mime ?? 'application/octet-stream')
    } catch (err) {
        if (err instanceof UnsupportedDocumentTypeError) {
            throw createError({
                statusCode: 422,
                statusMessage: `Cannot extract text from ${err.mime}`,
            })
        }
        throw err
    }

    if (extracted.text.trim().length === 0) {
        // Almost always a scanned PDF with no text layer. Saying so beats recording a document
        // with zero chunks that then answers no questions for reasons nobody can see.
        throw createError({
            statusCode: 422,
            statusMessage: 'No text found in this document (is it a scan without a text layer?)',
            // Tagged with a code because this is the one failure a normal user actually hits,
            // and the Dutch-first UI should not surface an English statusMessage for it.
            data: { code: 'document-no-text' },
        })
    }

    const sourceLabel = body.sourceLabel || body.title

    // `organisationId` in the metadata is what the advisor filters on at query time. Without it
    // this document becomes visible to every organisation's questions.
    const { chunks } = await ingestText({
        title: body.title,
        source: sourceLabel,
        text: extracted.text,
        metadata: {
            organisationId: body.organisationId,
            policyId: body.policyId ?? null,
            documentKind: body.kind,
            fileId: body.fileId,
        },
    })

    const [created] = await db
        .insert(policyDocuments)
        .values({
            organisationId: body.organisationId,
            policyId: body.policyId ?? null,
            fileId: body.fileId,
            title: body.title,
            sourceLabel,
            kind: body.kind,
            chunkCount: chunks,
            ingestedAt: new Date(),
        })
        .returning()

    if (!created) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to record document' })
    }

    await tryLogAudit(event, 'inkoopbeleid.document.ingested', user.id, {
        documentId: created.id,
        organisationId: body.organisationId,
        kind: body.kind,
        chunks,
    })

    return {
        document: created,
        chunks,
        pages: extracted.pages,
        warnings: extracted.warnings,
    }
})
