import { describe, expect, it } from 'vitest'
import {
    POLICY_STATUS_ORDER,
    allowedTransitions,
    assessCompleteness,
    canTransition,
    isRevision,
} from '#server/utils/inkoopbeleid/workflow'

/**
 * The workflow is what turns "a policy" into "a policy that went through review". These tests
 * pin the two properties that make it more than decoration: a reviewer can send a draft back,
 * and an adopted policy cannot be edited in place without becoming a new version.
 */

const CHAPTERS = (filled: number) =>
    Array.from({ length: 10 }, (_, i) => ({ contentMarkdown: i < filled ? 'inhoud' : '' }))

describe('the workflow graph', () => {
    it('walks the five steps of 0.2 in order', { timeout: 120_000 }, () => {
        expect(POLICY_STATUS_ORDER).toEqual([
            'analyse',
            'herijken',
            'opstellen',
            'bespreken',
            'vastgesteld',
        ])
    })

    it('allows each forward step', { timeout: 120_000 }, () => {
        expect(canTransition('analyse', 'herijken')).toBe(true)
        expect(canTransition('herijken', 'opstellen')).toBe(true)
        expect(canTransition('opstellen', 'bespreken')).toBe(true)
        expect(canTransition('bespreken', 'vastgesteld')).toBe(true)
    })

    it('lets a reviewer send a draft back, which is what makes "reject" mean anything', { timeout: 120_000 }, () => {
        expect(canTransition('bespreken', 'opstellen')).toBe(true)
        expect(canTransition('opstellen', 'herijken')).toBe(true)
        expect(canTransition('herijken', 'analyse')).toBe(true)
    })

    it('refuses to skip a step', { timeout: 120_000 }, () => {
        expect(canTransition('analyse', 'vastgesteld')).toBe(false)
        expect(canTransition('analyse', 'opstellen')).toBe(false)
        expect(canTransition('opstellen', 'vastgesteld')).toBe(false)
    })

    it('treats reopening an adopted policy as a revision', { timeout: 120_000 }, () => {
        expect(canTransition('vastgesteld', 'opstellen')).toBe(true)
        expect(isRevision('vastgesteld', 'opstellen')).toBe(true)
        // Every other move leaves the version number alone.
        expect(isRevision('opstellen', 'bespreken')).toBe(false)
        expect(isRevision('bespreken', 'opstellen')).toBe(false)
    })

    it('will not jump straight from adopted back to analysis', { timeout: 120_000 }, () => {
        expect(canTransition('vastgesteld', 'analyse')).toBe(false)
        expect(canTransition('vastgesteld', 'bespreken')).toBe(false)
    })

    it('returns no transitions for an unknown status instead of throwing', { timeout: 120_000 }, () => {
        // A row written by an older version of the app must not take the detail page down.
        expect(allowedTransitions('iets-ouds')).toEqual([])
        expect(canTransition('iets-ouds', 'opstellen')).toBe(false)
    })
})

describe('the completeness signal', () => {
    const base = {
        goalCount: 4,
        thresholdCount: 11,
        mandateCount: 13,
        periodStart: '2025-01-01',
        periodEnd: '2028-12-31',
        today: '2026-08-22',
    }

    it('scores a fully populated policy at 1', { timeout: 120_000 }, () => {
        const c = assessCompleteness({ ...base, chapters: CHAPTERS(10) })
        expect(c.chaptersFilled).toBe(10)
        expect(c.chapterTotal).toBe(10)
        expect(c.withinValidityPeriod).toBe(true)
        expect(c.score).toBe(1)
    })

    it('counts only chapters with real content', { timeout: 120_000 }, () => {
        const c = assessCompleteness({
            ...base,
            chapters: [{ contentMarkdown: '   \n  ' }, { contentMarkdown: 'echte inhoud' }],
        })
        // Whitespace is not content: a chapter someone opened and saved empty is still empty.
        expect(c.chaptersFilled).toBe(1)
        expect(c.chapterTotal).toBe(2)
    })

    it('reports an absent validity period as unknown, not as expired', { timeout: 120_000 }, () => {
        const c = assessCompleteness({
            ...base,
            chapters: CHAPTERS(10),
            periodStart: null,
            periodEnd: null,
        })
        // `null` is the load-bearing distinction: "we never said" reads differently to a reader
        // than "it ran out", and only one of them means the policy is unusable today.
        expect(c.withinValidityPeriod).toBeNull()
        expect(c.score).toBeLessThan(1)
    })

    it('detects an expired policy', { timeout: 120_000 }, () => {
        const c = assessCompleteness({ ...base, chapters: CHAPTERS(10), today: '2029-01-01' })
        expect(c.withinValidityPeriod).toBe(false)
    })

    it('detects a policy that has not started yet', { timeout: 120_000 }, () => {
        const c = assessCompleteness({ ...base, chapters: CHAPTERS(10), today: '2024-12-31' })
        expect(c.withinValidityPeriod).toBe(false)
    })

    it('treats the first and last day of the period as inside it', { timeout: 120_000 }, () => {
        expect(assessCompleteness({ ...base, chapters: CHAPTERS(10), today: '2025-01-01' }).withinValidityPeriod).toBe(true)
        expect(assessCompleteness({ ...base, chapters: CHAPTERS(10), today: '2028-12-31' }).withinValidityPeriod).toBe(true)
    })

    it('flags an organisation that has goals but no numbers', { timeout: 120_000 }, () => {
        // This is Welbions in the seed: goals recorded, thresholds and mandates not.
        const c = assessCompleteness({
            ...base,
            chapters: CHAPTERS(0),
            thresholdCount: 0,
            mandateCount: 0,
        })
        expect(c.hasGoals).toBe(true)
        expect(c.hasThresholds).toBe(false)
        expect(c.hasMandates).toBe(false)
        expect(c.score).toBeGreaterThan(0)
        expect(c.score).toBeLessThan(0.5)
    })

    it('scores an empty policy at 0', { timeout: 120_000 }, () => {
        const c = assessCompleteness({
            chapters: CHAPTERS(0),
            goalCount: 0,
            thresholdCount: 0,
            mandateCount: 0,
            periodStart: null,
            periodEnd: null,
            today: '2026-08-22',
        })
        expect(c.score).toBe(0)
    })
})
