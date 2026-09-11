import { describe, expect, it } from 'vitest'
import { PDF_MIME, extractDocumentText } from '../../server/utils/inkoopbeleid/extract'

/**
 * A hand-built, byte-accurate minimal PDF (one page, one text run), so the test exercises the
 * real PDF.js parser instead of mocking it. Offsets in the xref table are computed rather than
 * counted by hand, so the fixture stays correct if the object bodies above change.
 */
function minimalPdf(text: string): Buffer {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]'
        + ' /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    const stream = `BT /F1 24 Tf 50 100 Td (${text}) Tj ET`
    const objectBodies = [...objects, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`]

    let body = '%PDF-1.4\n'
    const offsets: number[] = []
    for (const [i, object] of objectBodies.entries()) {
        offsets.push(Buffer.byteLength(body))
        body += `${i + 1} 0 obj\n${object}\nendobj\n`
    }

    const xrefOffset = Buffer.byteLength(body)
    const xrefRows = offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
    const xref = `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n${xrefRows}`
    const trailer = `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

    return Buffer.from(body + xref + trailer, 'latin1')
}

describe('extractDocumentText - PDF', () => {
    it('reads a Node Buffer, not just a Uint8Array', { timeout: 120_000 }, async () => {
        // unpdf/pdf.js reject a `Buffer` outright at runtime ("Please provide binary data as
        // `Uint8Array`, rather than `Buffer`"), even though `Buffer` is a `Uint8Array` subclass.
        // Every real caller that reads a file off disk with `fs.readFile` gets exactly a `Buffer`.
        const buffer = minimalPdf('Hallo wereld')
        expect(Buffer.isBuffer(buffer)).toBe(true)

        const result = await extractDocumentText(buffer, PDF_MIME)

        expect(result.text).toBe('Hallo wereld')
        expect(result.pages).toBe(1)
    })
})
