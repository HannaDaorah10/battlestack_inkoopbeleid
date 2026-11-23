import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * CSV that survives the trip to Excel.
 *
 * Two details do the work. The separator is a semicolon, because a Dutch-locale Excel opens a
 * comma-separated file as one column per row and the colleague opening it has no reason to know
 * why. And the file starts with a UTF-8 byte-order mark, because without it that same Excel turns
 * every euro sign and accented character into mojibake.
 */

/**
 * Built from its code point rather than typed as a character: a literal BOM is invisible in a
 * diff and in an editor, so anyone reading this line would have to take the comment's word for
 * what is between the quotes.
 */
const UTF8_BOM = String.fromCharCode(0xFEFF)

/**
 * Generic over the row type so `columns` is checked against it: a column name that does not exist
 * on the row is a compile error rather than a silently empty column in the file someone else opens.
 */
export function toCsv<T extends object>(
    rows: readonly T[],
    columns: ReadonlyArray<keyof T & string>,
): string {
    const lines = [columns.map((c) => escapeCell(c)).join(';')]
    for (const row of rows) {
        lines.push(columns.map((c) => escapeCell(row[c])).join(';'))
    }
    return lines.join('\r\n')
}

export async function writeCsv<T extends object>(
    file: string,
    rows: readonly T[],
    columns: ReadonlyArray<keyof T & string>,
): Promise<void> {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `${UTF8_BOM}${toCsv(rows, columns)}\r\n`, 'utf8')
}

/**
 * Read back a CSV in the dialect {@link toCsv} writes - the reviewers' returned files.
 *
 * Quote-aware, because a reviewer's comment will contain a semicolon, a newline or a quote sooner
 * or later, and a naive split would silently shift every column after it. Lives here rather than in
 * `aggregate.ts` so both directions of the format stay in one file, and so a test can import it
 * without running a command-line entry point.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let inQuotes = false

    const body = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text

    for (let i = 0; i < body.length; i++) {
        const char = body[i]!

        if (inQuotes) {
            if (char === '"') {
                // A doubled quote is an escaped quote; a single one closes the field.
                if (body[i + 1] === '"') {
                    cell += '"'
                    i++
                } else {
                    inQuotes = false
                }
            } else {
                cell += char
            }
            continue
        }

        if (char === '"') {
            inQuotes = true
        } else if (char === ';') {
            row.push(cell)
            cell = ''
        } else if (char === '\n') {
            row.push(cell)
            rows.push(row)
            row = []
            cell = ''
        } else if (char !== '\r') {
            cell += char
        }
    }

    if (cell.length > 0 || row.length > 0) {
        row.push(cell)
        rows.push(row)
    }

    const header = rows.shift()
    if (!header) return []

    return rows
        .filter((r) => r.some((c) => c.trim().length > 0))
        .map((r) => Object.fromEntries(header.map((name, i) => [name.trim(), (r[i] ?? '').trim()])))
}

function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return ''

    // Decimals with a comma, matching the locale that reads the semicolons. The quoting below
    // keeps that comma from being mistaken for a separator.
    const text = typeof value === 'number' && !Number.isInteger(value)
        ? String(value).replace('.', ',')
        : String(value)

    if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
}
