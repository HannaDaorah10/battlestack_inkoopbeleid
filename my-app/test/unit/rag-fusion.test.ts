import { describe, expect, it } from 'vitest'
import { DEFAULT_RRF_K, fuseRrf } from '../../server/utils/rag-fusion'
import type { FusionCandidate } from '../../server/utils/rag-fusion'

function candidate(id: string): FusionCandidate {
    return { id, metadata: { text: `chunk ${id}` } }
}

describe('fuseRrf', () => {
    it('ranks a chunk both paths found above one only a single path found first', { timeout: 120_000 }, () => {
        // "b" is second in both lists; "a" is first in one and absent from the other.
        const fused = fuseRrf({
            dense: [candidate('a'), candidate('b')],
            keyword: [candidate('c'), candidate('b')],
        }, { topK: 3 })

        expect(fused[0]!.id).toBe('b')
        expect(fused[0]!.ranks).toEqual({ dense: 2, keyword: 2 })
    })

    it('scores by rank, never by the incoming scores', { timeout: 120_000 }, () => {
        const fused = fuseRrf({ dense: [candidate('a')] }, { k: 60, topK: 1 })
        expect(fused[0]!.score).toBeCloseTo(1 / 61, 10)
    })

    it('reports a null rank for the path that did not return a chunk', { timeout: 120_000 }, () => {
        const fused = fuseRrf({
            dense: [candidate('a')],
            keyword: [candidate('z')],
        }, { topK: 5 })

        expect(fused.find((h) => h.id === 'a')!.ranks).toEqual({ dense: 1, keyword: null })
        expect(fused.find((h) => h.id === 'z')!.ranks).toEqual({ dense: null, keyword: 1 })
    })

    it('keeps the best rank and scores once when a list repeats a chunk', { timeout: 120_000 }, () => {
        const fused = fuseRrf({ dense: [candidate('a'), candidate('a')] }, { k: 60, topK: 5 })
        expect(fused).toHaveLength(1)
        expect(fused[0]!.ranks).toEqual({ dense: 1 })
        expect(fused[0]!.score).toBeCloseTo(1 / 61, 10)
    })

    it('cuts the fused list to topK', { timeout: 120_000 }, () => {
        const many = ['a', 'b', 'c', 'd', 'e'].map(candidate)
        expect(fuseRrf({ dense: many }, { topK: 2 })).toHaveLength(2)
    })

    it('carries the metadata of whichever path saw the chunk first', { timeout: 120_000 }, () => {
        const fused = fuseRrf({ dense: [candidate('a')], keyword: [] }, { topK: 1 })
        expect(fused[0]!.metadata).toEqual({ text: 'chunk a' })
    })

    it('a smaller k sharpens the advantage of a rank-1 hit', { timeout: 120_000 }, () => {
        // With k=60 the top of one list (1/61) loses to two mid hits; with k=1 it wins.
        const lists = {
            dense: [candidate('top'), candidate('x'), candidate('y'), candidate('shared')],
            keyword: [candidate('p'), candidate('q'), candidate('r'), candidate('shared')],
        }
        expect(fuseRrf(lists, { k: DEFAULT_RRF_K, topK: 1 })[0]!.id).toBe('shared')
        expect(fuseRrf(lists, { k: 1, topK: 1 })[0]!.id).toBe('top')
    })

    it('returns nothing when every list is empty', { timeout: 120_000 }, () => {
        expect(fuseRrf({ dense: [], keyword: [] }, { topK: 5 })).toEqual([])
    })
})
