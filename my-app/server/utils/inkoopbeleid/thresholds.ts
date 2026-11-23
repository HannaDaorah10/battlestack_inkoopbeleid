import {
    PurchaseType,
    ThresholdRuleSet,
    type ExtraRequirement,
    type PurchaseProcedure,
} from '#server/database/schema/inkoopbeleid'

/**
 * The procurement rule engine.
 *
 * Every function here is PURE: no database, no clock, no config. The rows are handed in, the
 * verdict comes out. That is what makes "which procedure applies to a 30.000 euro cleaning
 * contract?" a question you can answer in a unit test in a millisecond instead of a question
 * you can only answer by standing up Postgres.
 *
 * Amounts are `bigint` cents throughout, never floats: 30.000 euro is `3_000_000`.
 */

// --- Constants from the policy -----------------------------------------------------------

/** Cents per euro, so the constants below read as euro amounts. */
const EUR = 100

/**
 * A recurring annual contract is valued at 4x its yearly amount when picking a tier. The rule
 * exists so a 3-year cleaning contract cannot be treated as a small purchase 3 times over.
 */
export const RECURRING_CONTRACT_MULTIPLIER = 4

/** Tenders expected to exceed this need advance approval from the Raad van Commissarissen. */
export const RVC_APPROVAL_THRESHOLD_CENTS = 1_000_000 * EUR

/** Any obligation at or above this per year, lasting over a year, must be centrally registered. */
export const CONTRACT_REGISTER_YEARLY_THRESHOLD_CENTS = 20_000 * EUR

/** A contract register entry is only required once the commitment outlives a single year. */
export const CONTRACT_REGISTER_MIN_DURATION_YEARS = 1

// --- Inputs ------------------------------------------------------------------------------

/**
 * Structural shape of a `thresholds` row. Deliberately not the Drizzle `$inferSelect` type: a
 * test should be able to build one from a literal without conjuring database-only columns.
 */
export interface ThresholdRule {
    ruleSet: string
    purchaseType: string
    minAmountCents: number
    /** `null` = no upper bound. Otherwise EXCLUSIVE, so a tier covers `[min, max)`. */
    maxAmountCents: number | null
    procedure: string
    minQuotes: number
    extraRequirement: string
    advisorRequired: boolean
}

/** Structural shape of a `mandates` row, for the same reason as {@link ThresholdRule}. */
export interface MandateRule {
    roleName: string
    department: string
    ceilingAmountCents: number
    scope: string
}

/** How often the spend repeats. Drives the x4 rule. */
export enum Recurrence {
    /** A one-off purchase: the amount entered IS the contract value. */
    Once = 'once',
    /** A recurring annual commitment: multiply by {@link RECURRING_CONTRACT_MULTIPLIER}. */
    Yearly = 'yearly',
}

/**
 * A machine-readable reason attached to a verdict. Codes, not sentences, so the UI renders them
 * through i18n in both locales and a future maturity-scoring module can count them.
 */
export enum ObligationCode {
    /** The x4 rule was applied because the spend recurs annually. */
    RecurringMultiplierApplied = 'recurring_multiplier_applied',
    /** An adviseur inkoop must be involved at this tier. */
    AdvisorRequired = 'advisor_required',
    /** Above the Raad van Commissarissen ceiling: advance approval needed. */
    SupervisoryBoardApproval = 'supervisory_board_approval',
    /** Must be entered in the central contract register. */
    ContractRegister = 'contract_register',
    /** Standing reminder that splitting a purchase to duck a threshold is forbidden. */
    AntiSplitting = 'anti_splitting',
    /** No role in this organisation may sign for this amount on its own. */
    NoMandateCovers = 'no_mandate_covers',
    /** The organisation has no threshold tier covering this amount. */
    NoThresholdMatches = 'no_threshold_matches',
}

export interface PurchaseInput {
    /** As typed by the user: per year when `recurrence` is yearly, otherwise the whole contract. */
    amountCents: number
    purchaseType: string
    recurrence?: Recurrence
    /** Contract length in years. Only used for the contract-register rule. */
    durationYears?: number
    ruleSet?: string
}

export interface PurchaseVerdict {
    /** What the user typed. */
    enteredAmountCents: number
    /** What the tier lookup actually used, after the x4 rule. */
    contractValueCents: number
    /** The matching tier, or `null` when this organisation has no tier covering the amount. */
    threshold: ThresholdRule | null
    procedure: PurchaseProcedure | string | null
    minQuotes: number | null
    extraRequirement: ExtraRequirement | string | null
    advisorRequired: boolean
    /** The lowest role whose ceiling covers the amount, or `null` when none does. */
    mandate: MandateRule | null
    /** Every other role sharing that same lowest ceiling. Empty unless the ceiling is shared. */
    mandateAlternatives: MandateRule[]
    supervisoryBoardApprovalRequired: boolean
    obligations: ObligationCode[]
}

// --- Core -------------------------------------------------------------------------------

function assertAmount(amountCents: number, label: string): void {
    if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents < 0) {
        throw new TypeError(`${label} must be a non-negative integer number of cents`)
    }
}

/**
 * Contract value used for tier selection: the entered amount, times 4 when it recurs annually.
 *
 * Split out from {@link selectProcedure} rather than folded into it, because the x4 rule is a
 * property of the SPEND, not of the tier table: it applies identically under both rule sets and
 * would otherwise have to be re-derived by every caller.
 */
export function contractValueCents(
    amountCents: number,
    recurrence: Recurrence = Recurrence.Once,
): number {
    assertAmount(amountCents, 'amountCents')
    return recurrence === Recurrence.Yearly
        ? amountCents * RECURRING_CONTRACT_MULTIPLIER
        : amountCents
}

/**
 * Pick the tier that governs a purchase.
 *
 * Tiers are half-open `[min, max)`, which is what makes the boundaries unambiguous: exactly
 * 50.000 euro of services lands in the 50.000-250.000 band, not in the one below it. That is
 * the difference between "at least" and "more than" in the source table, and getting it
 * backwards silently costs a quote on every boundary purchase.
 *
 * A rule whose `purchaseType` is `any` applies to every type, so the legacy set (which has no
 * werken/diensten split) works without a special case. When both a type-specific and an `any`
 * rule match, the type-specific one wins: it is the more precise statement of the same policy.
 *
 * Returns `null` when nothing matches, which is a real state, not an error: an organisation
 * with no thresholds seeded yet (Welbions, in this project) must produce "we cannot answer
 * that" rather than a fabricated tier.
 */
export function selectProcedure(input: {
    amountCents: number
    purchaseType: string
    thresholds: readonly ThresholdRule[]
    ruleSet?: string
}): ThresholdRule | null {
    assertAmount(input.amountCents, 'amountCents')
    const ruleSet = input.ruleSet ?? ThresholdRuleSet.Current

    const candidates = input.thresholds.filter(
        (t) =>
            t.ruleSet === ruleSet
            && (t.purchaseType === input.purchaseType || t.purchaseType === PurchaseType.Any)
            && input.amountCents >= t.minAmountCents
            && (t.maxAmountCents === null || input.amountCents < t.maxAmountCents),
    )
    if (candidates.length === 0) return null

    // Most specific first (an exact type beats `any`), then the highest floor. Overlapping
    // tiers are a data error the CHECK constraints cannot catch; picking deterministically
    // means a bad row produces a consistently wrong answer someone can reproduce and fix,
    // rather than one that changes with row order.
    const [best] = [...candidates].sort((a, b) => {
        const specificity = Number(b.purchaseType !== PurchaseType.Any)
            - Number(a.purchaseType !== PurchaseType.Any)
        if (specificity !== 0) return specificity
        return b.minAmountCents - a.minAmountCents
    })
    return best ?? null
}

/**
 * The lowest role whose ceiling still covers the amount.
 *
 * "Lowest" is the point: mandates answer "who is the least senior person who may sign this",
 * so routing a 1.000 euro purchase to the directeur-bestuurder is a wrong answer even though
 * their ceiling covers it.
 *
 * Ties are real in this data (three Ons Huis roles share the 50.000 euro ceiling). This returns
 * one of them deterministically, ordered by role name; use {@link findMandates} when the caller
 * should see all of them, because "Manager wonen" alone is a misleading answer when
 * "Manager bedrijfsbeheer" would do equally well.
 */
export function findMandate(input: {
    amountCents: number
    mandates: readonly MandateRule[]
}): MandateRule | null {
    return findMandates(input)[0] ?? null
}

/** Every role tied at the lowest covering ceiling, ordered by role name. */
export function findMandates(input: {
    amountCents: number
    mandates: readonly MandateRule[]
}): MandateRule[] {
    assertAmount(input.amountCents, 'amountCents')
    const covering = input.mandates.filter((m) => m.ceilingAmountCents >= input.amountCents)
    if (covering.length === 0) return []

    const lowest = Math.min(...covering.map((m) => m.ceilingAmountCents))
    return covering
        .filter((m) => m.ceilingAmountCents === lowest)
        .sort((a, b) => a.roleName.localeCompare(b.roleName, 'nl'))
}

/** Tenders expected to exceed the RvC ceiling need advance supervisory-board approval. */
export function requiresSupervisoryBoardApproval(contractValueCents: number): boolean {
    assertAmount(contractValueCents, 'contractValueCents')
    // Strictly greater: the policy says "expected to exceed", and the ceiling itself is also
    // the directeur-bestuurder's own mandate, which they may sign alone.
    return contractValueCents > RVC_APPROVAL_THRESHOLD_CENTS
}

/**
 * Whether the commitment must be entered in the central contract register.
 *
 * Keyed on the YEARLY amount and the duration, not on the contract value, because the rule is
 * written that way: a one-off 100.000 euro purchase is not a register entry, while 20.000 euro
 * a year for two years is.
 */
export function requiresContractRegister(input: {
    yearlyAmountCents: number
    durationYears: number
}): boolean {
    assertAmount(input.yearlyAmountCents, 'yearlyAmountCents')
    return (
        input.yearlyAmountCents >= CONTRACT_REGISTER_YEARLY_THRESHOLD_CENTS
        && input.durationYears > CONTRACT_REGISTER_MIN_DURATION_YEARS
    )
}

/**
 * Compose the whole verdict: which procedure, how many quotes, what paperwork, who signs.
 *
 * This is what `POST /api/inkoopbeleid/toets` returns. It is still pure, so the route stays a
 * thin "load rows, call this, respond" shell and every rule below is unit-testable.
 *
 * On the anti-splitting rule: it is emitted on EVERY verdict rather than detected, and that is
 * a deliberate limitation, not an oversight. Detecting it needs cumulative spend per supplier
 * or category, and this system has no supplier, contract or spend table to look at. Raising it
 * as a standing obligation states the rule honestly; claiming to have checked it would not.
 */
export function evaluatePurchase(input: PurchaseInput & {
    thresholds: readonly ThresholdRule[]
    mandates: readonly MandateRule[]
}): PurchaseVerdict {
    const recurrence = input.recurrence ?? Recurrence.Once
    const durationYears = input.durationYears ?? 1
    const value = contractValueCents(input.amountCents, recurrence)

    const threshold = selectProcedure({
        amountCents: value,
        purchaseType: input.purchaseType,
        thresholds: input.thresholds,
        ruleSet: input.ruleSet,
    })

    const mandateMatches = findMandates({ amountCents: value, mandates: input.mandates })
    const [mandate, ...mandateAlternatives] = mandateMatches
    const rvc = requiresSupervisoryBoardApproval(value)

    const obligations: ObligationCode[] = [ObligationCode.AntiSplitting]
    if (recurrence === Recurrence.Yearly) {
        obligations.unshift(ObligationCode.RecurringMultiplierApplied)
    }
    if (!threshold) obligations.push(ObligationCode.NoThresholdMatches)
    if (threshold?.advisorRequired) obligations.push(ObligationCode.AdvisorRequired)
    if (rvc) obligations.push(ObligationCode.SupervisoryBoardApproval)
    if (requiresContractRegister({ yearlyAmountCents: input.amountCents, durationYears })) {
        obligations.push(ObligationCode.ContractRegister)
    }
    // Only meaningful once the organisation actually has mandates; an empty table means
    // "not modelled yet", which is a different statement from "nobody may sign this".
    if (input.mandates.length > 0 && !mandate) {
        obligations.push(ObligationCode.NoMandateCovers)
    }

    return {
        enteredAmountCents: input.amountCents,
        contractValueCents: value,
        threshold,
        procedure: threshold?.procedure ?? null,
        minQuotes: threshold?.minQuotes ?? null,
        extraRequirement: threshold?.extraRequirement ?? null,
        advisorRequired: threshold?.advisorRequired ?? false,
        mandate: mandate ?? null,
        mandateAlternatives,
        supervisoryBoardApprovalRequired: rvc,
        obligations,
    }
}
