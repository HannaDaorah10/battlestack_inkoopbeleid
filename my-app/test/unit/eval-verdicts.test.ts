import { describe, expect, it } from 'vitest'
import { selectForReview } from '../../tools/eval/src/cli'
import { caseSchema } from '../../tools/eval/src/types'
import {
    findDisagreements,
    isLegacyVerdictFile,
    parseCijfer,
    parseVerdictRow,
    summariseVerdicts,
} from '../../tools/eval/src/verdicts'
import type { SleutelRow, Verdict } from '../../tools/eval/src/verdicts'

function config(label: string): SleutelRow {
    return {
        label,
        configId: `g_${label}`,
        model: `model-${label}`,
        temperature: 0,
        topP: 1,
        maxOutputTokens: 1200,
        systemPrompt: 'prompts/a.md',
    }
}

function verdict(overrides: Partial<Verdict>): Verdict {
    return {
        beoordelaar: 'sanne',
        caseId: 'q01',
        label: 'A',
        trekking: '0',
        cijfer: null,
        feitfout: false,
        opmerking: '',
        ...overrides,
    }
}

describe('parseCijfer', () => {
    it('accepts whole grades from 1 to 10', { timeout: 120_000 }, () => {
        expect([parseCijfer('1'), parseCijfer('10'), parseCijfer(' 7 ')]).toEqual([1, 10, 7])
    })

    it('accepts the "7,0" Excel may write back', { timeout: 120_000 }, () => {
        expect(parseCijfer('7,0')).toBe(7)
    })

    it('treats anything outside the scale as no grade rather than guessing', { timeout: 120_000 }, () => {
        expect([parseCijfer(''), parseCijfer(undefined), parseCijfer('0'), parseCijfer('11'), parseCijfer('6,5'), parseCijfer('goed')])
            .toEqual([null, null, null, null, null, null])
    })
})

describe('parseVerdictRow', () => {
    it('reads a row as the review page downloads it', { timeout: 120_000 }, () => {
        const row = { beoordelaar: 'Sanne', caseId: 'q01', label: 'B', trekking: '0', cijfer: '8', feitfout: 'nee', opmerking: 'prima' }
        expect(parseVerdictRow(row, 'bestand')).toEqual({
            beoordelaar: 'Sanne', caseId: 'q01', label: 'B', trekking: '0', cijfer: 8, feitfout: false, opmerking: 'prima',
        })
    })

    it('reads the error tick', { timeout: 120_000 }, () => {
        expect(parseVerdictRow({ label: 'A', feitfout: 'ja' }, 'x')!.feitfout).toBe(true)
    })

    it('falls back to the file name when the reviewer left their name empty', { timeout: 120_000 }, () => {
        expect(parseVerdictRow({ beoordelaar: '', label: 'A' }, 'beoordeling-sanne')!.beoordelaar).toBe('beoordeling-sanne')
    })

    it('skips a row without a label', { timeout: 120_000 }, () => {
        expect(parseVerdictRow({ label: '' }, 'x')).toBeNull()
    })
})

describe('isLegacyVerdictFile', () => {
    it('recognises a download from the Goed/Twijfel/Fout page', { timeout: 120_000 }, () => {
        expect(isLegacyVerdictFile([{ beoordelaar: 'x', label: 'A', oordeel: 'goed', opmerking: '' }])).toBe(true)
    })

    it('does not flag the current format or an empty file', { timeout: 120_000 }, () => {
        expect(isLegacyVerdictFile([{ label: 'A', cijfer: '7', feitfout: 'nee' }])).toBe(false)
        expect(isLegacyVerdictFile([])).toBe(false)
    })
})

describe('summariseVerdicts', () => {
    it('averages the grades per configuration', { timeout: 120_000 }, () => {
        const [row] = summariseVerdicts([config('A')], [
            verdict({ caseId: 'q01', cijfer: 7 }),
            verdict({ caseId: 'q02', cijfer: 8 }),
        ])
        expect(row).toMatchObject({ beoordeeld: 2, gemiddeldCijfer: 7.5, gecorrigeerdCijfer: 7.5, onvoldoendes: 0 })
    })

    it('counts a 5 as failing and a 6 as passing', { timeout: 120_000 }, () => {
        const [row] = summariseVerdicts([config('A')], [
            verdict({ caseId: 'q01', cijfer: 5 }),
            verdict({ caseId: 'q02', cijfer: 6 }),
        ])
        expect(row!.onvoldoendes).toBe(1)
    })

    it('ranks fewer factual errors above a higher grade', { timeout: 120_000 }, () => {
        // B reads nicer, but got a threshold wrong once. In this domain that is the worse config.
        const rows = summariseVerdicts([config('A'), config('B')], [
            verdict({ label: 'A', caseId: 'q01', cijfer: 6 }),
            verdict({ label: 'A', caseId: 'q02', cijfer: 6 }),
            verdict({ label: 'B', caseId: 'q01', cijfer: 9 }),
            verdict({ label: 'B', caseId: 'q02', cijfer: 6, feitfout: true }),
        ])
        expect(rows.map((r) => r.label)).toEqual(['A', 'B'])
        expect(rows[1]).toMatchObject({ feitfouten: 1, percentageFeitfout: 50 })
    })

    it('ranks by grade when neither configuration made a factual error', { timeout: 120_000 }, () => {
        const rows = summariseVerdicts([config('A'), config('B')], [
            verdict({ label: 'A', cijfer: 6 }),
            verdict({ label: 'B', cijfer: 8 }),
        ])
        expect(rows.map((r) => r.label)).toEqual(['B', 'A'])
    })

    it('counts an answer ticked as wrong but left ungraded as judged', { timeout: 120_000 }, () => {
        const [row] = summariseVerdicts([config('A')], [verdict({ feitfout: true })])
        expect(row).toMatchObject({ beoordeeld: 1, feitfouten: 1, gemiddeldCijfer: null })
    })

    it('puts a configuration nobody judged last instead of first on a 0% error rate', { timeout: 120_000 }, () => {
        const rows = summariseVerdicts([config('A'), config('B')], [
            verdict({ label: 'B', cijfer: 4, feitfout: true }),
        ])
        expect(rows.map((r) => r.label)).toEqual(['B', 'A'])
        expect(rows[1]).toMatchObject({ beoordeeld: 0, gemiddeldCijfer: null })
    })

    it('corrects for a reviewer who grades more leniently than the other', { timeout: 120_000 }, () => {
        // Both reviewers find A and B equally good; the lenient one just happened to grade B.
        // Raw averages would favour B; corrected averages must not.
        const rows = summariseVerdicts([config('A'), config('B')], [
            verdict({ beoordelaar: 'streng', label: 'A', caseId: 'q01', cijfer: 6 }),
            verdict({ beoordelaar: 'streng', label: 'C', caseId: 'q02', cijfer: 6 }),
            verdict({ beoordelaar: 'mild', label: 'B', caseId: 'q01', cijfer: 9 }),
            verdict({ beoordelaar: 'mild', label: 'C', caseId: 'q02', cijfer: 9 }),
        ])
        const a = rows.find((r) => r.label === 'A')!
        const b = rows.find((r) => r.label === 'B')!
        expect(b.gemiddeldCijfer).toBeGreaterThan(a.gemiddeldCijfer!)
        expect(b.gecorrigeerdCijfer).toBe(a.gecorrigeerdCijfer)
    })
})

describe('findDisagreements', () => {
    it('reports grades three or more points apart', { timeout: 120_000 }, () => {
        const found = findDisagreements([
            verdict({ beoordelaar: 'sanne', cijfer: 8 }),
            verdict({ beoordelaar: 'piet', cijfer: 5, opmerking: 'drempel klopt niet' }),
        ])
        expect(found).toHaveLength(1)
        expect(found[0]).toMatchObject({ caseId: 'q01', label: 'A', spreiding: 3 })
    })

    it('leaves ordinary differences in taste alone', { timeout: 120_000 }, () => {
        expect(findDisagreements([
            verdict({ beoordelaar: 'sanne', cijfer: 8 }),
            verdict({ beoordelaar: 'piet', cijfer: 6 }),
        ])).toEqual([])
    })

    it('reports a split on the factual-error tick even when the grades agree', { timeout: 120_000 }, () => {
        const found = findDisagreements([
            verdict({ beoordelaar: 'sanne', cijfer: 6 }),
            verdict({ beoordelaar: 'piet', cijfer: 6, feitfout: true }),
        ])
        expect(found).toHaveLength(1)
        expect(found[0]!.spreiding).toBe(0)
    })

    it('never compares different answers or a single reviewer with themselves', { timeout: 120_000 }, () => {
        expect(findDisagreements([
            verdict({ caseId: 'q01', cijfer: 9 }),
            verdict({ caseId: 'q02', cijfer: 2 }),
            verdict({ label: 'B', cijfer: 2 }),
        ])).toEqual([])
    })
})

describe('selectForReview', () => {
    const cases = [
        caseSchema.parse({ id: 'q01', vraag: 'Eerste vraag?', beoordelen: true }),
        caseSchema.parse({ id: 'q02', vraag: 'Tweede vraag?' }),
        caseSchema.parse({ id: 'q03', vraag: 'Derde vraag?', beoordelen: true }),
    ]

    it('keeps only the questions marked for review', { timeout: 120_000 }, () => {
        expect(selectForReview(cases).map((c) => c.id)).toEqual(['q01', 'q03'])
    })

    it('reviews everything when a question file marks nothing', { timeout: 120_000 }, () => {
        const unmarked = cases.map((c) => ({ ...c, beoordelen: false }))
        expect(selectForReview(unmarked).map((c) => c.id)).toEqual(['q01', 'q02', 'q03'])
    })

    it('defaults the flag to false for question files that predate it', { timeout: 120_000 }, () => {
        expect(caseSchema.parse({ id: 'q09', vraag: 'Oude vraag?' }).beoordelen).toBe(false)
    })
})
