/**
 * Turn an uploaded policy document into plain text the RAG pipeline can chunk.
 *
 * Kept as a pure `(bytes, mime) -> text` function with no database, storage or Nitro access,
 * so it can be exercised against a real client PDF in isolation the moment one arrives.
 *
 * `unpdf` rather than `pdf-parse`/`pdfjs-dist` directly: it ships a serverless build of PDF.js
 * that runs inside Nitro without a DOM or a worker thread, which the alternatives assume.
 */

/** MIME types this module knows how to read. */
export const PDF_MIME = 'application/pdf'
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const TEXT_MIMES = ['text/plain', 'text/markdown', 'text/csv'] as const

export interface ExtractResult {
    text: string
    /** Page count for PDFs; `null` for formats with no page concept. */
    pages: number | null
    /** Non-fatal problems the converter reported, e.g. an unmapped DOCX style. */
    warnings: string[]
}

export class UnsupportedDocumentTypeError extends Error {
    constructor(readonly mime: string) {
        super(`Unsupported document type: ${mime}`)
        this.name = 'UnsupportedDocumentTypeError'
    }
}

/** Whether {@link extractDocumentText} can handle this MIME type. */
export function isExtractableMime(mime: string): boolean {
    const normalised = normaliseMime(mime)
    return (
        normalised === PDF_MIME
        || normalised === DOCX_MIME
        || (TEXT_MIMES as readonly string[]).includes(normalised)
    )
}

/** Strip parameters and casing: `text/plain; charset=utf-8` is still `text/plain`. */
function normaliseMime(mime: string): string {
    const base = mime.split(';')[0] ?? ''
    return base.trim().toLowerCase()
}

/**
 * Extract plain text from a document.
 *
 * @throws {UnsupportedDocumentTypeError} when the MIME type is not one of the supported ones.
 *   Thrown rather than returning empty text, because "we could not read this" and "this file
 *   contains nothing" need different answers at the call site.
 */
export async function extractDocumentText(
    bytes: Uint8Array,
    mime: string,
): Promise<ExtractResult> {
    const normalised = normaliseMime(mime)

    if (normalised === PDF_MIME) return extractPdf(bytes)
    if (normalised === DOCX_MIME) return extractDocx(bytes)
    if ((TEXT_MIMES as readonly string[]).includes(normalised)) {
        return { text: normaliseWhitespace(new TextDecoder().decode(bytes)), pages: null, warnings: [] }
    }

    throw new UnsupportedDocumentTypeError(normalised)
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
    // Imported lazily so a project that never uploads a PDF does not pay PDF.js's load cost on
    // every cold start, and so this module stays importable in a plain node test context.
    const { extractText } = await import('unpdf')

    // unpdf/pdf.js reject a Node `Buffer` outright at runtime ("Please provide binary data as
    // `Uint8Array`, rather than `Buffer`"), even though `Buffer` is a `Uint8Array` subclass and
    // satisfies this function's own type signature. Re-view the same memory as a plain
    // `Uint8Array` (no copy) so a caller that read the file with `fs.readFile` - which returns a
    // `Buffer` - still works.
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)

    // `mergePages: false` keeps the per-page split, which we then join with a form feed. Page
    // boundaries survive into the chunker that way, so a retrieved excerpt can still be traced
    // back to a page when someone asks "where does it say that?".
    const { totalPages, text } = await extractText(view, { mergePages: false })
    const pages = Array.isArray(text) ? text : [text]

    return {
        text: normaliseWhitespace(pages.join('\n\n\f\n\n')),
        pages: totalPages,
        warnings: [],
    }
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractResult> {
    const mammoth = await import('mammoth')

    // `extractRawText`, not `convertToHtml`: the consumer is an embedding model, which gains
    // nothing from markup and is only diluted by it.
    const result = await mammoth.default.extractRawText({ buffer: Buffer.from(bytes) })

    return {
        text: normaliseWhitespace(result.value),
        pages: null,
        warnings: result.messages.map((m) => m.message),
    }
}

/**
 * Tidy extracted text without destroying structure.
 *
 * PDF extraction routinely emits stray carriage returns, runs of spaces where a table cell was,
 * and long stretches of blank lines. Collapsing those improves chunking. Single newlines are
 * left alone: in a policy document a line break is often the only thing separating one threshold
 * row from the next, and flattening them merges rules that must stay distinct.
 */
export function normaliseWhitespace(text: string): string {
    return text
        .replace(/\r\n?/g, '\n')
        // Non-breaking (U+00A0), figure (U+2007) and narrow no-break (U+202F) spaces come through
        // PDF extraction constantly, especially inside amounts written as "2 000 000". Written as
        // escapes, not literal characters: they are invisible in a diff, and ESLint rejects them in
        // source for exactly that reason.
        .replace(/[\u00A0\u2007\u2009\u202F]/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
