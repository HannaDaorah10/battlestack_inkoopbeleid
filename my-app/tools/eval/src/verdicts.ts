/**
 * Pure logic behind `eval:aggregate`: reading a reviewer's CSV row, and turning everyone's scores
 * into a ranking and a list of disagreements.
 *
 * Kept out of `aggregate.ts` for the same reason `scoring.ts` is kept out of `retrieval.ts`: that
 * file calls `main()` at import time, so a unit test importing it would run an aggregation.
 *
 * Reviewers give every answer a school grade from 1 to 10, plus a separate "contains a factual
 * error" tick. The two are kept apart on purpose. A grade says how good an answer is relative to
 * the others; the tick records the one thing that must not be averaged away - a wrong threshold
 * or signing authority - even on an answer that is otherwise pleasant enough to earn a 6.
 */

export interface Verdict {
    beoordelaar: string
    caseId: string
    label: string
    trekking: string
    /** 1-10, or null when the reviewer ticked the error box or left a comment without grading. */
    cijfer: number | null
    feitfout: boolean
    opmerking: string
}

export interface SleutelRow {
    label: string
    configId: string
    model: string
    temperature: number
    topP: number
    maxOutputTokens: number
    systemPrompt: string
}

export interface RankingRow {
    label: string
    configId: string
    model: string
    temperature: number
    topP: number
    systemPrompt: string
    beoordeeld: number
    gemiddeldCijfer: number | null
    /** The average after correcting for how strict each reviewer grades; see `summariseVerdicts`. */
    gecorrigeerdCijfer: number | null
    onvoldoendes: number
    feitfouten: number
    percentageFeitfout: number
}

export interface Disagreement {
    caseId: string
    label: string
    /** Highest minus lowest grade, or null when fewer than two reviewers gave a grade. */
    spreiding: number | null
    oordelen: Array<{ beoordelaar: string, cijfer: number | null, feitfout: boolean, opmerking: string }>
}

/** A 5 is the highest failing grade on the Dutch school scale reviewers are used to. */
export const ONVOLDOENDE_MAX = 5

/**
 * Grades this far apart on the same answer are worth a look. One or two points is ordinary
 * difference in taste between reviewers; three is the gap between "fine" and "not good enough".
 */
export const DISAGREEMENT_SPREAD = 3

/**
 * A file downloaded from the earlier review page, which asked for Goed/Twijfel/Fout. Those verdicts
 * cannot be turned into grades without inventing numbers, so the caller skips the file and says so.
 */
export function isLegacyVerdictFile(rows: ReadonlyArray<Record<string, string>>): boolean {
    const first = rows[0]
    return first !== undefined && 'oordeel' in first && !('cijfer' in first)
}

export function parseVerdictRow(row: Record<string, string>, fallbackName: string): Verdict | null {
    const label = row.label ?? ''
    if (label.length === 0) return null

    return {
        beoordelaar: row.beoordelaar || fallbackName,
        caseId: row.caseId ?? '',
        label,
        trekking: row.trekking || '0',
        cijfer: parseCijfer(row.cijfer),
        feitfout: parseYes(row.feitfout),
        opmerking: row.opmerking ?? '',
    }
}

/**
 * Anything that is not a whole number from 1 to 10 counts as no grade. Excel may hand a reviewer's
 * file back with "7,0", so a decimal comma is accepted as long as the value is whole.
 */
export function parseCijfer(raw: string | undefined): number | null {
    if (raw === undefined || raw.trim() === '') return null
    const value = Number(raw.trim().replace(',', '.'))
    return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null
}

function parseYes(raw: string | undefined): boolean {
    return ['ja', 'true', '1', 'x'].includes((raw ?? '').trim().toLowerCase())
}

export function summariseVerdicts(
    sleutel: readonly SleutelRow[],
    verdicts: readonly Verdict[],
): RankingRow[] {
    // One reviewer's 7 is another's 8. Shifting every grade by how far its reviewer's own average
    // sits from the overall average removes that habit, so a configuration is not favoured just
    // because the lenient reviewer happened to grade more of its answers. With a single reviewer
    // the shift is zero and both averages are the same.
    const graded = verdicts.filter((v) => v.cijfer !== null)
    const overall = mean(graded.map((v) => v.cijfer!))
    const reviewerMeans = new Map<string, number>()
    for (const name of new Set(graded.map((v) => v.beoordelaar))) {
        reviewerMeans.set(name, mean(graded.filter((v) => v.beoordelaar === name).map((v) => v.cijfer!)))
    }

    const rows = sleutel.map((config): RankingRow => {
        const own = verdicts.filter((v) => v.label === config.label)
        const judged = own.filter((v) => v.cijfer !== null || v.feitfout)
        const grades = own.filter((v) => v.cijfer !== null)
        const feitfouten = own.filter((v) => v.feitfout).length

        return {
            label: config.label,
            configId: config.configId,
            model: config.model,
            temperature: config.temperature,
            topP: config.topP,
            systemPrompt: config.systemPrompt,
            beoordeeld: judged.length,
            gemiddeldCijfer: grades.length > 0 ? round1(mean(grades.map((v) => v.cijfer!))) : null,
            gecorrigeerdCijfer: grades.length > 0
                ? round1(mean(grades.map((v) => v.cijfer! - reviewerMeans.get(v.beoordelaar)! + overall)))
                : null,
            onvoldoendes: grades.filter((v) => v.cijfer! <= ONVOLDOENDE_MAX).length,
            feitfouten,
            percentageFeitfout: judged.length > 0 ? round1((feitfouten / judged.length) * 100) : 0,
        }
    })

    // Unjudged configurations last, so a 0% error rate that means "nobody looked" never outranks a
    // measured one. Then fewest factual errors: in this domain a confidently wrong threshold costs
    // more than a clumsy sentence, so an answer that errs less wins over one that reads nicer.
    // Only then the grade, corrected for reviewer strictness.
    rows.sort((a, b) =>
        (Number(a.beoordeeld === 0) - Number(b.beoordeeld === 0))
        || (a.percentageFeitfout - b.percentageFeitfout)
        || ((b.gecorrigeerdCijfer ?? 0) - (a.gecorrigeerdCijfer ?? 0))
        || ((b.gemiddeldCijfer ?? 0) - (a.gemiddeldCijfer ?? 0)))
    return rows
}

export function findDisagreements(verdicts: readonly Verdict[]): Disagreement[] {
    const groups = new Map<string, Verdict[]>()
    for (const verdict of verdicts) {
        if (verdict.cijfer === null && !verdict.feitfout) continue
        const key = `${verdict.caseId}|${verdict.label}|${verdict.trekking}`
        const bucket = groups.get(key) ?? []
        bucket.push(verdict)
        groups.set(key, bucket)
    }

    const out: Disagreement[] = []
    for (const bucket of groups.values()) {
        if (bucket.length < 2) continue

        const grades = bucket.flatMap((v) => (v.cijfer === null ? [] : [v.cijfer]))
        const spreiding = grades.length >= 2 ? Math.max(...grades) - Math.min(...grades) : null
        const splitOnError = new Set(bucket.map((v) => v.feitfout)).size > 1

        if (!splitOnError && (spreiding === null || spreiding < DISAGREEMENT_SPREAD)) continue

        out.push({
            caseId: bucket[0]!.caseId,
            label: bucket[0]!.label,
            spreiding,
            oordelen: bucket.map((v) => ({
                beoordelaar: v.beoordelaar,
                cijfer: v.cijfer,
                feitfout: v.feitfout,
                opmerking: v.opmerking,
            })),
        })
    }

    return out
}

function mean(values: readonly number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function round1(value: number): number {
    return Math.round(value * 10) / 10
}
