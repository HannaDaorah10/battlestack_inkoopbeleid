import { PolicyStatus } from '#server/database/schema/inkoopbeleid'
import { POLICY_CHAPTER_COUNT } from '#server/utils/inkoopbeleid/chapters'

/**
 * The 0.2 workflow, as rules rather than as prose.
 *
 * Pure and clock-free (today's date is injected), so both the transition graph and the
 * completeness signal are unit-testable without a database or a fixed system time.
 */

/** The five steps in the order a policy walks them. */
export const POLICY_STATUS_ORDER: readonly PolicyStatus[] = [
    PolicyStatus.Analyse,
    PolicyStatus.Herijken,
    PolicyStatus.Opstellen,
    PolicyStatus.Bespreken,
    PolicyStatus.Vastgesteld,
]

/**
 * Which moves are legal from each step.
 *
 * Not a straight line, on purpose. Steps 0.2.2 and 0.2.4 exist to let stakeholders push back,
 * so "bespreken" must be able to return to "opstellen" when a reviewer rejects the draft;
 * a graph that only moves forward would make the reject decision decorative.
 *
 * `vastgesteld` is not a dead end either: an adopted policy can be reopened for revision, which
 * is what makes `policies.version` a real number instead of a column that is always 1. See
 * {@link isRevision}.
 */
const TRANSITIONS: Readonly<Record<PolicyStatus, readonly PolicyStatus[]>> = {
    [PolicyStatus.Analyse]: [PolicyStatus.Herijken],
    [PolicyStatus.Herijken]: [PolicyStatus.Opstellen, PolicyStatus.Analyse],
    [PolicyStatus.Opstellen]: [PolicyStatus.Bespreken, PolicyStatus.Herijken],
    [PolicyStatus.Bespreken]: [PolicyStatus.Vastgesteld, PolicyStatus.Opstellen],
    [PolicyStatus.Vastgesteld]: [PolicyStatus.Opstellen],
}

/** Every status reachable in one step from `from`. Empty for an unknown status. */
export function allowedTransitions(from: string): readonly PolicyStatus[] {
    return TRANSITIONS[from as PolicyStatus] ?? []
}

export function canTransition(from: string, to: string): boolean {
    return allowedTransitions(from).includes(to as PolicyStatus)
}

/**
 * Reopening an adopted policy. The caller bumps `policies.version` when this is true, so the
 * adopted document and the one being rewritten are never confused for the same revision.
 */
export function isRevision(from: string, to: string): boolean {
    return from === PolicyStatus.Vastgesteld && to === PolicyStatus.Opstellen
}

// --- Completeness signal -----------------------------------------------------------------

export interface CompletenessInput {
    chapters: ReadonlyArray<{ contentMarkdown: string }>
    goalCount: number
    thresholdCount: number
    mandateCount: number
    periodStart: string | null
    periodEnd: string | null
    /** `YYYY-MM-DD`. Injected rather than read from the clock, so this stays pure. */
    today: string
}

export interface CompletenessSignal {
    chaptersFilled: number
    chapterTotal: number
    hasGoals: boolean
    hasThresholds: boolean
    hasMandates: boolean
    /** `null` when the policy has no validity period recorded, which is not the same as expired. */
    withinValidityPeriod: boolean | null
    /** 0..1, rounded to two decimals. */
    score: number
}

/**
 * How finished a policy is, as data.
 *
 * Deliberately a signal and not a grade: it reports which of the five things are present and
 * a blunt average, and leaves interpretation to the maturity-scoring module that will read it.
 * Weighting these five against each other is that module's job, not this one's.
 */
export function assessCompleteness(input: CompletenessInput): CompletenessSignal {
    const chaptersFilled = input.chapters.filter((c) => c.contentMarkdown.trim().length > 0).length
    const chapterTotal = input.chapters.length || POLICY_CHAPTER_COUNT

    const hasGoals = input.goalCount > 0
    const hasThresholds = input.thresholdCount > 0
    const hasMandates = input.mandateCount > 0
    const withinValidityPeriod = assessValidity(input)

    const parts = [
        chapterTotal > 0 ? chaptersFilled / chapterTotal : 0,
        hasGoals ? 1 : 0,
        hasThresholds ? 1 : 0,
        hasMandates ? 1 : 0,
        // An absent period counts as 0: a policy with no stated validity is incomplete, even
        // though it is not expired. `withinValidityPeriod: null` is what carries that nuance.
        withinValidityPeriod === true ? 1 : 0,
    ]
    const score = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) / 100

    return {
        chaptersFilled,
        chapterTotal,
        hasGoals,
        hasThresholds,
        hasMandates,
        withinValidityPeriod,
        score,
    }
}

/**
 * Whether `today` falls inside the policy's validity period.
 *
 * Dates are compared as `YYYY-MM-DD` strings, which sort lexicographically in calendar order
 * and sidestep the timezone shift that parsing them into `Date` would introduce. An open-ended
 * bound is treated as unbounded on that side.
 */
function assessValidity(input: CompletenessInput): boolean | null {
    if (!input.periodStart && !input.periodEnd) return null
    if (input.periodStart && input.today < input.periodStart) return false
    if (input.periodEnd && input.today > input.periodEnd) return false
    return true
}

/** Today as `YYYY-MM-DD`. The one place the clock is read, kept out of the pure functions. */
export function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10)
}
