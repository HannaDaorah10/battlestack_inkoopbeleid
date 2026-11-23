import { describe, expect, it } from 'vitest'
import {
    CONTRACT_REGISTER_YEARLY_THRESHOLD_CENTS,
    ObligationCode,
    RECURRING_CONTRACT_MULTIPLIER,
    RVC_APPROVAL_THRESHOLD_CENTS,
    Recurrence,
    contractValueCents,
    evaluatePurchase,
    findMandate,
    findMandates,
    requiresContractRegister,
    requiresSupervisoryBoardApproval,
    selectProcedure,
    type MandateRule,
    type ThresholdRule,
} from '#server/utils/inkoopbeleid/thresholds'

/**
 * The rule engine is the one part of this module where a wrong answer is expensive and silent:
 * a purchase run with one quote too few is only discovered by an auditor, months later. So the
 * tests below pin the two worked examples from the brief AND every tier boundary, because
 * off-by-one at a boundary is exactly the failure that looks right in a demo.
 *
 * No database, no server: `selectProcedure` and friends take rows as arguments.
 */

const EUR = 100

/** Ons Huis 2025-2028, chapter 6. Same values the seed writes. */
const THRESHOLDS: ThresholdRule[] = [
    // Werken
    { ruleSet: 'current', purchaseType: 'werken', minAmountCents: 2_000_000 * EUR, maxAmountCents: null, procedure: 'meervoudig_onderhands', minQuotes: 3, extraRequirement: 'categoriemanagement', advisorRequired: true },
    { ruleSet: 'current', purchaseType: 'werken', minAmountCents: 500_000 * EUR, maxAmountCents: 2_000_000 * EUR, procedure: 'meervoudig_onderhands', minQuotes: 3, extraRequirement: 'strategie_en_gunningsadvies', advisorRequired: false },
    { ruleSet: 'current', purchaseType: 'werken', minAmountCents: 100_000 * EUR, maxAmountCents: 500_000 * EUR, procedure: 'meervoudig_onderhands', minQuotes: 3, extraRequirement: 'gunningsadvies', advisorRequired: false },
    { ruleSet: 'current', purchaseType: 'werken', minAmountCents: 0, maxAmountCents: 100_000 * EUR, procedure: 'enkelvoudig_onderhands', minQuotes: 1, extraRequirement: 'vastleggen_offerteaanvraag', advisorRequired: false },
    // Diensten en leveringen
    { ruleSet: 'current', purchaseType: 'diensten_leveringen', minAmountCents: 250_000 * EUR, maxAmountCents: null, procedure: 'meervoudig_onderhands', minQuotes: 3, extraRequirement: 'categoriemanagement', advisorRequired: true },
    { ruleSet: 'current', purchaseType: 'diensten_leveringen', minAmountCents: 50_000 * EUR, maxAmountCents: 250_000 * EUR, procedure: 'meervoudig_onderhands', minQuotes: 2, extraRequirement: 'strategie_en_gunningsadvies', advisorRequired: false },
    { ruleSet: 'current', purchaseType: 'diensten_leveringen', minAmountCents: 25_000 * EUR, maxAmountCents: 50_000 * EUR, procedure: 'meervoudig_onderhands', minQuotes: 2, extraRequirement: 'vastleggen_offerteaanvraag', advisorRequired: false },
    { ruleSet: 'current', purchaseType: 'diensten_leveringen', minAmountCents: 0, maxAmountCents: 25_000 * EUR, procedure: 'enkelvoudig_onderhands', minQuotes: 1, extraRequirement: 'vastleggen_offerteaanvraag', advisorRequired: false },
    // Legacy (appendix 2), no werken/diensten split
    { ruleSet: 'legacy', purchaseType: 'any', minAmountCents: 100_000 * EUR, maxAmountCents: null, procedure: 'aanbesteding', minQuotes: 3, extraRequirement: 'gunningsadvies', advisorRequired: false },
    { ruleSet: 'legacy', purchaseType: 'any', minAmountCents: 15_000 * EUR, maxAmountCents: 100_000 * EUR, procedure: 'offerteprocedure', minQuotes: 2, extraRequirement: 'vastleggen_offerteaanvraag', advisorRequired: false },
    { ruleSet: 'legacy', purchaseType: 'any', minAmountCents: 0, maxAmountCents: 15_000 * EUR, procedure: 'een_op_een', minQuotes: 1, extraRequirement: 'vastleggen_offerteaanvraag', advisorRequired: false },
]

const MANDATES: MandateRule[] = [
    { roleName: 'Directeur-bestuurder', department: '', ceilingAmountCents: 1_000_000 * EUR, scope: 'alles' },
    { roleName: 'Manager vastgoed', department: 'Vastgoed', ceilingAmountCents: 100_000 * EUR, scope: 'vastgoed' },
    { roleName: 'Manager bedrijfsbeheer', department: 'Bedrijfsbeheer', ceilingAmountCents: 50_000 * EUR, scope: 'algemeen' },
    { roleName: 'Manager wonen', department: 'Wonen', ceilingAmountCents: 50_000 * EUR, scope: 'huurders' },
    { roleName: 'Coordinator ICT', department: 'Bedrijfsbeheer', ceilingAmountCents: 15_000 * EUR, scope: 'ICT' },
    { roleName: 'Wijkbeheerder', department: 'Wonen', ceilingAmountCents: 1_000 * EUR, scope: 'huurdersservicecontracten' },
]

function tier(amountEuros: number, purchaseType: string, ruleSet = 'current') {
    return selectProcedure({
        amountCents: amountEuros * EUR,
        purchaseType,
        thresholds: THRESHOLDS,
        ruleSet,
    })
}

describe('selectProcedure - the brief\'s two worked examples', () => {
    it('30.000 euro of services needs 2 quotes and no procurement advisor', { timeout: 120_000 }, () => {
        const result = tier(30_000, 'diensten_leveringen')

        expect(result).not.toBeNull()
        expect(result?.procedure).toBe('meervoudig_onderhands')
        expect(result?.minQuotes).toBe(2)
        expect(result?.extraRequirement).toBe('vastleggen_offerteaanvraag')
        expect(result?.advisorRequired).toBe(false)
    })

    it('2.500.000 euro of works needs 3 quotes, category management and the advisor', { timeout: 120_000 }, () => {
        const result = tier(2_500_000, 'werken')

        expect(result).not.toBeNull()
        expect(result?.procedure).toBe('meervoudig_onderhands')
        expect(result?.minQuotes).toBe(3)
        expect(result?.extraRequirement).toBe('categoriemanagement')
        expect(result?.advisorRequired).toBe(true)
    })
})

describe('selectProcedure - tier boundaries', () => {
    // Every boundary is tested from BOTH sides. A tier is half-open `[min, max)`, so the
    // amount exactly equal to a boundary belongs to the tier above, and one cent less to the
    // tier below. Testing only one side would pass under either reading.
    const cases: Array<{ euros: number, type: string, quotes: number, procedure: string, why: string }> = [
        { euros: 24_999, type: 'diensten_leveringen', quotes: 1, procedure: 'enkelvoudig_onderhands', why: 'just below 25.000' },
        { euros: 25_000, type: 'diensten_leveringen', quotes: 2, procedure: 'meervoudig_onderhands', why: 'exactly 25.000' },
        { euros: 49_999, type: 'diensten_leveringen', quotes: 2, procedure: 'meervoudig_onderhands', why: 'just below 50.000' },
        { euros: 50_000, type: 'diensten_leveringen', quotes: 2, procedure: 'meervoudig_onderhands', why: 'exactly 50.000' },
        { euros: 249_999, type: 'diensten_leveringen', quotes: 2, procedure: 'meervoudig_onderhands', why: 'just below 250.000' },
        { euros: 250_000, type: 'diensten_leveringen', quotes: 3, procedure: 'meervoudig_onderhands', why: 'exactly 250.000' },
        { euros: 99_999, type: 'werken', quotes: 1, procedure: 'enkelvoudig_onderhands', why: 'just below 100.000' },
        { euros: 100_000, type: 'werken', quotes: 3, procedure: 'meervoudig_onderhands', why: 'exactly 100.000' },
        { euros: 499_999, type: 'werken', quotes: 3, procedure: 'meervoudig_onderhands', why: 'just below 500.000' },
        { euros: 500_000, type: 'werken', quotes: 3, procedure: 'meervoudig_onderhands', why: 'exactly 500.000' },
        { euros: 1_999_999, type: 'werken', quotes: 3, procedure: 'meervoudig_onderhands', why: 'just below 2.000.000' },
        { euros: 2_000_000, type: 'werken', quotes: 3, procedure: 'meervoudig_onderhands', why: 'exactly 2.000.000' },
    ]

    for (const c of cases) {
        it(`${c.euros} euro ${c.type} (${c.why}) -> ${c.quotes} quote(s)`, { timeout: 120_000 }, () => {
            const result = tier(c.euros, c.type)
            expect(result).not.toBeNull()
            expect(result?.minQuotes).toBe(c.quotes)
            expect(result?.procedure).toBe(c.procedure)
        })
    }

    it('the 50.000 boundary changes the paperwork even though the quote count is unchanged', { timeout: 120_000 }, () => {
        // The reason both sides of this boundary say "2 quotes": the tiers differ by their
        // extra requirement, not their quote count. A test that only checked minQuotes here
        // would pass with the boundary encoded backwards.
        expect(tier(49_999, 'diensten_leveringen')?.extraRequirement).toBe('vastleggen_offerteaanvraag')
        expect(tier(50_000, 'diensten_leveringen')?.extraRequirement).toBe('strategie_en_gunningsadvies')
    })

    it('the 500.000 boundary is encoded as exclusive, per the source-typo decision', { timeout: 120_000 }, () => {
        // The source PDF prints "> 500.000" for the 100.000-500.000 row. Encoded as "<", which
        // makes the four werken tiers partition the range with no gap and no overlap.
        expect(tier(499_999, 'werken')?.extraRequirement).toBe('gunningsadvies')
        expect(tier(500_000, 'werken')?.extraRequirement).toBe('strategie_en_gunningsadvies')
    })

    it('werken is stricter than diensten at the same amount', { timeout: 120_000 }, () => {
        expect(tier(30_000, 'werken')?.minQuotes).toBe(1)
        expect(tier(30_000, 'diensten_leveringen')?.minQuotes).toBe(2)
        expect(tier(150_000, 'werken')?.minQuotes).toBe(3)
        expect(tier(150_000, 'diensten_leveringen')?.minQuotes).toBe(2)
    })

    it('zero is covered by the lowest tier', { timeout: 120_000 }, () => {
        expect(tier(0, 'diensten_leveringen')?.procedure).toBe('enkelvoudig_onderhands')
        expect(tier(0, 'werken')?.procedure).toBe('enkelvoudig_onderhands')
    })
})

describe('selectProcedure - rule sets', () => {
    it('the legacy set applies to any purchase type', { timeout: 120_000 }, () => {
        expect(tier(30_000, 'werken', 'legacy')?.procedure).toBe('offerteprocedure')
        expect(tier(30_000, 'diensten_leveringen', 'legacy')?.procedure).toBe('offerteprocedure')
    })

    it('legacy boundaries are half-open too', { timeout: 120_000 }, () => {
        expect(tier(14_999, 'werken', 'legacy')?.procedure).toBe('een_op_een')
        expect(tier(15_000, 'werken', 'legacy')?.procedure).toBe('offerteprocedure')
        expect(tier(99_999, 'werken', 'legacy')?.procedure).toBe('offerteprocedure')
        expect(tier(100_000, 'werken', 'legacy')?.procedure).toBe('aanbesteding')
    })

    it('the two rule sets disagree on the same amount, which is the point of keeping both', { timeout: 120_000 }, () => {
        expect(tier(30_000, 'diensten_leveringen', 'current')?.procedure).toBe('meervoudig_onderhands')
        expect(tier(30_000, 'diensten_leveringen', 'legacy')?.procedure).toBe('offerteprocedure')
    })

    it('defaults to the current rule set', { timeout: 120_000 }, () => {
        const withoutRuleSet = selectProcedure({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            thresholds: THRESHOLDS,
        })
        expect(withoutRuleSet?.procedure).toBe('meervoudig_onderhands')
    })

    it('returns null when the organisation has no thresholds at all', { timeout: 120_000 }, () => {
        // Welbions, in this project: an organisation with goals but no numbers yet must produce
        // "we cannot answer that", never a fabricated tier.
        const result = selectProcedure({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            thresholds: [],
        })
        expect(result).toBeNull()
    })

    it('rejects a negative amount instead of guessing a tier', { timeout: 120_000 }, () => {
        expect(() => tier(-1, 'werken')).toThrow(TypeError)
    })
})

describe('findMandate', () => {
    it('returns the LOWEST role that can still sign, not the most senior', { timeout: 120_000 }, () => {
        const result = findMandate({ amountCents: 800 * EUR, mandates: MANDATES })
        expect(result?.roleName).toBe('Wijkbeheerder')
    })

    it('steps up to the next role once the ceiling is passed', { timeout: 120_000 }, () => {
        expect(findMandate({ amountCents: 1_000 * EUR, mandates: MANDATES })?.roleName).toBe('Wijkbeheerder')
        expect(findMandate({ amountCents: 1_001 * EUR, mandates: MANDATES })?.roleName).toBe('Coordinator ICT')
    })

    it('a ceiling covers the amount exactly equal to it', { timeout: 120_000 }, () => {
        // Inclusive, unlike the threshold tiers: a mandate says "up to and including".
        expect(findMandate({ amountCents: 15_000 * EUR, mandates: MANDATES })?.roleName).toBe('Coordinator ICT')
    })

    it('reports every role tied at the same lowest ceiling', { timeout: 120_000 }, () => {
        // Two Ons Huis roles share the 50.000 ceiling. Naming only one of them would send
        // someone to the wrong manager.
        const all = findMandates({ amountCents: 40_000 * EUR, mandates: MANDATES })
        expect(all.map((m) => m.roleName)).toEqual(['Manager bedrijfsbeheer', 'Manager wonen'])
    })

    it('returns null when no role may sign the amount', { timeout: 120_000 }, () => {
        expect(findMandate({ amountCents: 2_000_000 * EUR, mandates: MANDATES })).toBeNull()
    })
})

describe('the x4 recurring-contract rule', () => {
    it('multiplies a yearly amount by four', { timeout: 120_000 }, () => {
        expect(contractValueCents(30_000 * EUR, Recurrence.Yearly)).toBe(120_000 * EUR)
        expect(RECURRING_CONTRACT_MULTIPLIER).toBe(4)
    })

    it('leaves a one-off amount alone', { timeout: 120_000 }, () => {
        expect(contractValueCents(30_000 * EUR, Recurrence.Once)).toBe(30_000 * EUR)
        expect(contractValueCents(30_000 * EUR)).toBe(30_000 * EUR)
    })

    it('pushes a recurring contract into a higher tier', { timeout: 120_000 }, () => {
        // 30.000/year of services is a 2-quote purchase read literally, but 120.000 over the
        // contract, which is the tier that also demands a strategy document.
        const oneOff = evaluatePurchase({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            recurrence: Recurrence.Once,
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })
        const yearly = evaluatePurchase({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            recurrence: Recurrence.Yearly,
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })

        expect(oneOff.extraRequirement).toBe('vastleggen_offerteaanvraag')
        expect(yearly.contractValueCents).toBe(120_000 * EUR)
        expect(yearly.extraRequirement).toBe('strategie_en_gunningsadvies')
        expect(yearly.obligations).toContain(ObligationCode.RecurringMultiplierApplied)
    })
})

describe('supervisory board and contract register', () => {
    it('the RvC threshold is strictly greater than 1.000.000', { timeout: 120_000 }, () => {
        expect(RVC_APPROVAL_THRESHOLD_CENTS).toBe(1_000_000 * EUR)
        expect(requiresSupervisoryBoardApproval(1_000_000 * EUR)).toBe(false)
        expect(requiresSupervisoryBoardApproval(1_000_001 * EUR)).toBe(true)
    })

    it('the contract register needs both a yearly amount AND a duration over one year', { timeout: 120_000 }, () => {
        expect(CONTRACT_REGISTER_YEARLY_THRESHOLD_CENTS).toBe(20_000 * EUR)
        expect(requiresContractRegister({ yearlyAmountCents: 20_000 * EUR, durationYears: 2 })).toBe(true)
        expect(requiresContractRegister({ yearlyAmountCents: 19_999 * EUR, durationYears: 5 })).toBe(false)
        // A big one-off purchase is not a register entry: the rule is about ongoing obligations.
        expect(requiresContractRegister({ yearlyAmountCents: 100_000 * EUR, durationYears: 1 })).toBe(false)
    })
})

describe('evaluatePurchase - the composed verdict', () => {
    it('answers the brief\'s 30.000 euro services example end to end', { timeout: 120_000 }, () => {
        const v = evaluatePurchase({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })

        expect(v.procedure).toBe('meervoudig_onderhands')
        expect(v.minQuotes).toBe(2)
        expect(v.extraRequirement).toBe('vastleggen_offerteaanvraag')
        expect(v.advisorRequired).toBe(false)
        expect(v.obligations).not.toContain(ObligationCode.AdvisorRequired)
        expect(v.mandate?.roleName).toBe('Manager bedrijfsbeheer')
        expect(v.supervisoryBoardApprovalRequired).toBe(false)
    })

    it('answers the brief\'s 2.500.000 euro works example end to end', { timeout: 120_000 }, () => {
        const v = evaluatePurchase({
            amountCents: 2_500_000 * EUR,
            purchaseType: 'werken',
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })

        expect(v.minQuotes).toBe(3)
        expect(v.extraRequirement).toBe('categoriemanagement')
        expect(v.advisorRequired).toBe(true)
        expect(v.obligations).toContain(ObligationCode.AdvisorRequired)
        expect(v.supervisoryBoardApprovalRequired).toBe(true)
        expect(v.obligations).toContain(ObligationCode.SupervisoryBoardApproval)
        // Beyond every ceiling in the table, so it must escalate rather than name a signer.
        expect(v.mandate).toBeNull()
        expect(v.obligations).toContain(ObligationCode.NoMandateCovers)
    })

    it('always raises the anti-splitting rule', { timeout: 120_000 }, () => {
        // Stated on every verdict rather than detected: there is no supplier or spend table to
        // check cumulative spend against, so the honest move is to raise the rule, not to imply
        // it was verified.
        const v = evaluatePurchase({
            amountCents: 1 * EUR,
            purchaseType: 'werken',
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })
        expect(v.obligations).toContain(ObligationCode.AntiSplitting)
    })

    it('distinguishes "no mandates modelled" from "nobody may sign"', { timeout: 120_000 }, () => {
        // An organisation with an empty mandate table has not said nobody may sign; it has said
        // nothing. Claiming the former would be a fabricated governance answer.
        const v = evaluatePurchase({
            amountCents: 2_500_000 * EUR,
            purchaseType: 'werken',
            thresholds: THRESHOLDS,
            mandates: [],
        })
        expect(v.mandate).toBeNull()
        expect(v.obligations).not.toContain(ObligationCode.NoMandateCovers)
    })

    it('reports no matching tier rather than inventing one', { timeout: 120_000 }, () => {
        const v = evaluatePurchase({
            amountCents: 30_000 * EUR,
            purchaseType: 'diensten_leveringen',
            thresholds: [],
            mandates: MANDATES,
        })
        expect(v.threshold).toBeNull()
        expect(v.procedure).toBeNull()
        expect(v.minQuotes).toBeNull()
        expect(v.obligations).toContain(ObligationCode.NoThresholdMatches)
    })

    it('keeps the entered amount separate from the assessed contract value', { timeout: 120_000 }, () => {
        const v = evaluatePurchase({
            amountCents: 25_000 * EUR,
            purchaseType: 'diensten_leveringen',
            recurrence: Recurrence.Yearly,
            durationYears: 3,
            thresholds: THRESHOLDS,
            mandates: MANDATES,
        })
        expect(v.enteredAmountCents).toBe(25_000 * EUR)
        expect(v.contractValueCents).toBe(100_000 * EUR)
        expect(v.obligations).toContain(ObligationCode.ContractRegister)
    })
})
