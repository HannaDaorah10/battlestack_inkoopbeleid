import { describe, expect, it } from 'vitest'
import { errorRun, summarise } from '../../tools/eval/src/scoring'
import type { EvalCase, RetrievalConfig, RetrievalRun } from '../../tools/eval/src/types'

function config(overrides: Partial<RetrievalConfig> = {}): RetrievalConfig {
    return {
        configId: 'r_1',
        embeddingModel: 'bedrock/eu.cohere.embed-v4:0',
        maxChunkSize: 500,
        chunkOverlap: 100,
        topK: 5,
        ...overrides,
    }
}

function evalCase(overrides: Partial<EvalCase> = {}): EvalCase {
    return {
        id: 'q01',
        vraag: 'Hoeveel offertes bij EUR 30.000?',
        organisatie: 'ons-huis',
        verwachteTrefwoorden: ['25.000', '50.000'],
        tags: [],
        ...overrides,
    }
}

function okRun(overrides: Partial<RetrievalRun> = {}): RetrievalRun {
    return {
        configId: 'r_1',
        caseId: 'q01',
        scoreable: true,
        hit: true,
        firstHitRank: 1,
        reciprocalRank: 1,
        topScore: 0.9,
        fragments: [],
        durationMs: 10,
        error: null,
        ...overrides,
    }
}

describe('errorRun', () => {
    it('marks the case as errored without touching scoreable', { timeout: 120_000 }, () => {
        const run = errorRun(config(), evalCase(), 'model niet gevonden')
        expect(run.error).toBe('model niet gevonden')
        expect(run.scoreable).toBe(true)
        expect(run.hit).toBe(false)
        expect(run.fragments).toEqual([])
    })

    it('leaves scoreable false for a case with no expected keywords', { timeout: 120_000 }, () => {
        const run = errorRun(config(), evalCase({ verwachteTrefwoorden: [] }), 'fout')
        expect(run.scoreable).toBe(false)
    })
})

describe('summarise', () => {
    it('scores a configuration with no errors exactly as before', { timeout: 120_000 }, () => {
        const [row] = summarise([config()], [okRun(), okRun({ caseId: 'q02', hit: false, reciprocalRank: 0 })])
        expect(row).toMatchObject({ 'beoordeeldeVragen': 2, 'gevonden': 1, 'recall@k': 0.5, 'fouten': 0 })
    })

    it('excludes errored runs from recall, mrr and topscore instead of counting them as misses', { timeout: 120_000 }, () => {
        const runs = [
            okRun(),
            errorRun(config(), evalCase({ id: 'q02' }), 'embeddingmodel faalt'),
        ]
        const [row] = summarise([config()], runs)

        // Only the one successful run counts: recall is 1/1, not 1/2.
        expect(row).toMatchObject({ 'beoordeeldeVragen': 1, 'gevonden': 1, 'recall@k': 1, 'fouten': 1 })
    })

    it('ranks a config that was actually measured at zero above one that never ran', { timeout: 120_000 }, () => {
        const measuredZero = config({ configId: 'r_measured' })
        const neverRan = config({ configId: 'r_broken' })

        const rows = summarise(
            [neverRan, measuredZero],
            [
                okRun({ configId: 'r_measured', hit: false, reciprocalRank: 0, topScore: 0.2 }),
                errorRun(neverRan, evalCase(), 'Publisher model not found'),
            ],
        )

        expect(rows[0]!.configId).toBe('r_measured')
        expect(rows[0]!.fouten).toBe(0)
        expect(rows[1]!.configId).toBe('r_broken')
        expect(rows[1]!.fouten).toBe(1)
        // Both show recall@k 0 - the ranking, not this number, is what tells them apart.
        expect(rows[0]!['recall@k']).toBe(0)
        expect(rows[1]!['recall@k']).toBe(0)
    })
})
