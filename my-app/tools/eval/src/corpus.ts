import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import {
    DOCX_MIME,
    PDF_MIME,
    UnsupportedDocumentTypeError,
    extractDocumentText,
} from '../../../server/utils/inkoopbeleid/extract'
import { evalPath } from './paths'
import type { CorpusEntry } from './types'

/**
 * Read the source documents off disk with the app's own extractor.
 *
 * Reused rather than reimplemented on purpose: page-break handling and whitespace normalisation
 * decide where chunk boundaries land, and chunking is exactly what a retrieval sweep is measuring.
 * A second extractor with slightly different quirks would tune the harness, not the app.
 */

export interface CorpusDocument {
    title: string
    source: string
    organisatie: string
    text: string
    pages: number | null
    warnings: string[]
}

const MIME_BY_EXTENSION: Record<string, string> = {
    '.pdf': PDF_MIME,
    '.docx': DOCX_MIME,
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
}

export async function loadCorpus(entries: readonly CorpusEntry[]): Promise<CorpusDocument[]> {
    const documents: CorpusDocument[] = []

    for (const entry of entries) {
        const normalised = typeof entry === 'string'
            ? { path: entry, organisatie: 'onbekend', titel: undefined }
            : entry

        const absolute = evalPath(normalised.path)
        const extension = extname(absolute).toLowerCase()
        const mime = MIME_BY_EXTENSION[extension]

        if (!mime) {
            throw new Error(
                `Onbekend bestandstype "${extension}" voor ${normalised.path}. `
                + `Ondersteund: ${Object.keys(MIME_BY_EXTENSION).join(', ')}.`,
            )
        }

        let bytes: Uint8Array
        try {
            bytes = await readFile(absolute)
        } catch {
            throw new Error(
                `Kan ${normalised.path} niet lezen. Verwacht op: ${absolute}. `
                + 'Zet de documenten in tools/eval/corpus/ (die map staat in .gitignore).',
            )
        }

        let extracted
        try {
            extracted = await extractDocumentText(bytes, mime)
        } catch (err) {
            if (err instanceof UnsupportedDocumentTypeError) {
                throw new Error(
                    `${normalised.path}: bestandstype ${err.mime} wordt niet ondersteund.`,
                    { cause: err },
                )
            }
            throw err
        }

        // The app returns a `document-no-text` error for this and refuses to index; the harness
        // stops for the same reason. A scanned PDF has no text layer, so every configuration would
        // score zero and the sweep would look like a modelling problem rather than a missing OCR
        // step.
        if (extracted.text.trim().length === 0) {
            throw new Error(
                `${normalised.path} bevat geen tekst. Waarschijnlijk een gescande PDF zonder `
                + 'tekstlaag; die moet eerst door OCR voordat er iets te doorzoeken valt.',
            )
        }

        const title = normalised.titel ?? basename(absolute, extension)
        documents.push({
            title,
            // Mirrors the app, where `source` defaults to the document title and is the literal
            // token the prompt tells the agent to cite.
            source: title,
            organisatie: normalised.organisatie ?? 'onbekend',
            text: extracted.text,
            pages: extracted.pages,
            warnings: extracted.warnings,
        })
    }

    return documents
}

export function organisationsIn(documents: readonly CorpusDocument[]): Set<string> {
    return new Set(documents.map((d) => d.organisatie))
}

/**
 * The documents a question may search.
 *
 * An unknown organisation falls back to the whole corpus with a warning from the caller, rather
 * than returning nothing: an empty result set looks identical to "retrieval failed" in the report,
 * and a typo in a slug would read as a modelling result.
 */
export function documentsFor(
    documents: readonly CorpusDocument[],
    organisatie: string,
): CorpusDocument[] {
    const scoped = documents.filter((d) => d.organisatie === organisatie)
    return scoped.length > 0 ? scoped : [...documents]
}
