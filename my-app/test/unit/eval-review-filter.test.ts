import { describe, expect, it } from 'vitest'
import { scoreConfigsByHeuristics, selectConfigsForReview } from '../../tools/eval/src/review-filter'
import type { GenerationRun } from '../../tools/eval/src/types'

function run(overrides: Partial<GenerationRun> = {}): GenerationRun {
    return {
        configId: 'g_1',
        caseId: 'q01',
        sampleIndex: 0,
        answer: 'Twee offertes.',
        error: null,
        finishReason: 'stop',
        promptTokens: 10,
        completionTokens: 5,
        durationMs: 100,
        grounded: true,
        sources: [],
        flags: [],
        ...overrides,
    }
}

describe('scoreConfigsByHeuristics', () => {
    it('counts errors and flags per configuration', { timeout: 120_000 }, () => {
        const runs = [
            run({ configId: 'g_1', flags: ['bedrag-niet-in-bron'] }),
            run({ configId: 'g_1', caseId: 'q02', error: 'timeout', answer: '' }),
            run({ configId: 'g_2' }),
        ]
        const scores = scoreConfigsByHeuristics(['g_1', 'g_2'], runs)
        expect(scores).toEqual([
            { configId: 'g_1', fouten: 1, flagCount: 1, antwoorden: 2 },
            { configId: 'g_2', fouten: 0, flagCount: 0, antwoorden: 1 },
        ])
    })
})

describe('selectConfigsForReview', () => {
    it('ranks fewer errors above fewer flags', { timeout: 120_000 }, () => {
        const runs = [
            run({ configId: 'g_broken', error: 'timeout', answer: '' }),
            run({ configId: 'g_flagged', flags: ['bedrag-niet-in-bron', 'niet-nederlands'] }),
            run({ configId: 'g_clean' }),
        ]
        const top = selectConfigsForReview(['g_broken', 'g_flagged', 'g_clean'], runs, 2)
        expect(top).toEqual(['g_clean', 'g_flagged'])
    })

    it('never returns more than topN configurations', { timeout: 120_000 }, () => {
        const runs = [run({ configId: 'g_1' }), run({ configId: 'g_2' }), run({ configId: 'g_3' })]
        expect(selectConfigsForReview(['g_1', 'g_2', 'g_3'], runs, 3)).toHaveLength(3)
        expect(selectConfigsForReview(['g_1', 'g_2', 'g_3'], runs, 1)).toHaveLength(1)
    })

    it('keeps the given order among ties', { timeout: 120_000 }, () => {
        const runs = [run({ configId: 'g_a' }), run({ configId: 'g_b' }), run({ configId: 'g_c' })]
        expect(selectConfigsForReview(['g_c', 'g_a', 'g_b'], runs, 2)).toEqual(['g_c', 'g_a'])
    })
})
