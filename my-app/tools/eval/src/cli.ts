import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { evalPath } from './paths'
import { caseSchema, sweepSchema } from './types'
import type { EvalCase, Sweep } from './types'

export interface CliOptions {
    /** Path to the sweep definition, relative to tools/eval unless absolute. */
    config: string
    /** Expand the grid and report what it would cost, without calling anything. */
    dryRun: boolean
    /** Run only the first N questions, for a smoke test. */
    limit: number | null
    /** Phase 2 only: which retrieval configuration to build context with. */
    retrieval: string | null
}

export function readCliOptions(argv = process.argv.slice(2)): CliOptions {
    // `pnpm eval:retrieval -- --dry-run` forwards the separator itself, so argv arrives as
    // ['--', '--dry-run'] and parseArgs rejects the bare '--' as a positional. Dropping it here
    // means the documented pnpm form and a direct `tsx ... --dry-run` both work.
    const args = argv.filter((arg) => arg !== '--')

    const { values } = parseArgs({
        args,
        options: {
            'config': { type: 'string', short: 'c', default: 'config/sweep.json' },
            'dry-run': { type: 'boolean', default: false },
            'limit': { type: 'string' },
            'retrieval': { type: 'string' },
        },
        allowPositionals: false,
    })

    const limit = values.limit === undefined ? null : Number(values.limit)
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
        throw new Error(`--limit moet een positief geheel getal zijn, kreeg "${values.limit}".`)
    }

    return {
        config: values.config ?? 'config/sweep.json',
        dryRun: values['dry-run'] ?? false,
        limit,
        retrieval: values.retrieval ?? null,
    }
}

export async function loadSweep(path: string): Promise<Sweep> {
    const absolute = evalPath(path)
    let raw: string
    try {
        raw = await readFile(absolute, 'utf8')
    } catch {
        throw new Error(
            `Geen sweep-bestand op ${absolute}. `
            + 'Kopieer config/sweep.example.json naar config/sweep.json en pas hem aan.',
        )
    }

    const parsed = sweepSchema.safeParse(JSON.parse(stripJsonComments(raw)))
    if (!parsed.success) {
        throw new Error(`${path} klopt niet:\n${formatIssues(parsed.error.issues)}`)
    }
    return parsed.data
}

export async function loadCases(file: string, limit: number | null): Promise<EvalCase[]> {
    const absolute = evalPath(file)
    let raw: string
    try {
        raw = await readFile(absolute, 'utf8')
    } catch {
        throw new Error(`Geen vragenbestand op ${absolute}.`)
    }

    const cases: EvalCase[] = []
    const seen = new Set<string>()

    raw.split('\n').forEach((line, index) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('//')) return

        const parsed = caseSchema.safeParse(JSON.parse(trimmed))
        if (!parsed.success) {
            throw new Error(`${file} regel ${index + 1} klopt niet:\n${formatIssues(parsed.error.issues)}`)
        }
        // Ids key the resume set and the report columns, so a duplicate would silently overwrite
        // another question's result instead of adding one.
        if (seen.has(parsed.data.id)) {
            throw new Error(`${file} regel ${index + 1}: id "${parsed.data.id}" komt twee keer voor.`)
        }
        seen.add(parsed.data.id)
        cases.push(parsed.data)
    })

    if (cases.length === 0) throw new Error(`${file} bevat geen vragen.`)
    return limit === null ? cases : cases.slice(0, limit)
}

function formatIssues(issues: ReadonlyArray<{ path: PropertyKey[], message: string }>): string {
    return issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
}

/**
 * Strip `//` line comments so the sweep file can be annotated.
 *
 * String-aware, because a comment stripper that is not will happily gut a URL: `https://...`
 * contains the very token it is looking for.
 */
export function stripJsonComments(input: string): string {
    let out = ''
    let inString = false
    let escaped = false

    for (let i = 0; i < input.length; i++) {
        const char = input[i]!

        if (inString) {
            out += char
            if (escaped) escaped = false
            else if (char === '\\') escaped = true
            else if (char === '"') inString = false
            continue
        }

        if (char === '"') {
            inString = true
            out += char
            continue
        }

        if (char === '/' && input[i + 1] === '/') {
            while (i < input.length && input[i] !== '\n') i++
            out += '\n'
            continue
        }

        out += char
    }

    return out
}
