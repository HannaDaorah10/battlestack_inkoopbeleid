import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getClient, bucket, newObjectKey } from '#server/utils/storage'

const MAX_SIZE = 100 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
    'application/pdf',
    // Word documents: policy sources arrive as .docx at least as often as PDF, and
    // `server/utils/inkoopbeleid/extract.ts` reads them via mammoth.
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/zip',
])

export default defineEventHandler(async (event) => {
    await requireUserSession(event)

    const parts = await readMultipartFormData(event)
    const filePart = parts?.find((p) => p.name === 'file')
    if (!filePart?.data) throw createError({ statusCode: 400, statusMessage: 'Missing file' })

    const contentType = filePart.type || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
        throw createError({ statusCode: 422, statusMessage: 'File type not allowed' })
    }
    if (filePart.data.length > MAX_SIZE) {
        throw createError({ statusCode: 413, statusMessage: 'File too large (max 100 MB)' })
    }

    const filename = filePart.filename || 'file'
    const ext = filename.includes('.') ? filename.split('.').pop() : undefined
    const key = newObjectKey('uploads', ext)

    await getClient().send(
        new PutObjectCommand({
            Bucket: bucket(),
            Key: key,
            Body: filePart.data,
            ContentType: contentType,
            ContentLength: filePart.data.length,
        }),
    )

    return { key, size: filePart.data.length, mime: contentType || null }
})
