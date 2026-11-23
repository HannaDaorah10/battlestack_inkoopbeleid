import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Append-only JSONL, which is what makes a sweep resumable.
 *
 * A run is a long sequence of independent, individually paid-for calls. Writing each result the
 * moment it lands means an interrupted run has already banked everything it finished, and the next
 * start picks up where it stopped instead of paying twice. That is the same reason a batch job
 * checkpoints per array index rather than at the end.
 */

export async function readJsonl<T>(file: string): Promise<T[]> {
    let raw: string
    try {
        raw = await readFile(file, 'utf8')
    } catch {
        return []
    }
    const out: T[] = []
    for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
            out.push(JSON.parse(trimmed) as T)
        } catch {
            // A torn final line is what an interrupted write looks like. Skipping it costs one
            // result, which the run redoes; refusing to read the file would cost all of them.
            continue
        }
    }
    return out
}

export interface JsonlWriter {
    append(row: unknown): Promise<void>
}

export async function createJsonlWriter(file: string): Promise<JsonlWriter> {
    await mkdir(dirname(file), { recursive: true })

    // Writes are chained rather than issued concurrently. The pool has several workers finishing
    // at once, and two overlapping appends can interleave into one corrupt line.
    let tail: Promise<void> = Promise.resolve()

    return {
        append(row: unknown): Promise<void> {
            tail = tail.then(() => appendFile(file, `${JSON.stringify(row)}\n`, 'utf8'))
            return tail
        },
    }
}

/**
 * Keys of the cells already recorded, so the runner can skip them.
 *
 * The key must name a cell exactly: same configuration, same question, same draw. `sampleIndex` is
 * part of it precisely because repeated draws of one configuration are supposed to differ.
 */
export function cellKey(configId: string, caseId: string, sampleIndex = 0): string {
    return `${configId}|${caseId}|${sampleIndex}`
}

export function completedCells(
    rows: ReadonlyArray<{ configId: string, caseId: string, sampleIndex?: number }>,
): Set<string> {
    return new Set(rows.map((r) => cellKey(r.configId, r.caseId, r.sampleIndex ?? 0)))
}
