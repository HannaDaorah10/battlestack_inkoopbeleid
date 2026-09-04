import { describe, expect, it } from 'vitest'
import {
    configId,
    expandGeneration,
    expandGrid,
    expandRetrieval,
    groupByIndex,
    indexKey,
} from '../../tools/eval/src/expand'

describe('expandGrid', () => {
    it('produces the cartesian product', { timeout: 120_000 }, () => {
        const rows = expandGrid({ a: [1, 2], b: ['x', 'y', 'z'] })
        expect(rows).toHaveLength(6)
        expect(rows).toContainEqual({ a: 1, b: 'x' })
        expect(rows).toContainEqual({ a: 2, b: 'z' })
    })

    it('returns one empty row for an empty grid', { timeout: 120_000 }, () => {
        expect(expandGrid({})).toEqual([{}])
    })

    it('orders rows identically regardless of key order in the source object', { timeout: 120_000 }, () => {
        const one = expandGrid({ a: [1, 2], b: ['x', 'y'] })
        const other = expandGrid({ b: ['x', 'y'], a: [1, 2] })
        expect(one).toEqual(other)
    })

    it('refuses a dimension with no values instead of silently dropping it', { timeout: 120_000 }, () => {
        expect(() => expandGrid({ a: [1], b: [] })).toThrow(/no values/)
    })
})

describe('configId', () => {
    it('is stable across key order', { timeout: 120_000 }, () => {
        expect(configId('g', { model: 'gpt', temperature: 0 }))
            .toBe(configId('g', { temperature: 0, model: 'gpt' }))
    })

    it('changes when any value changes', { timeout: 120_000 }, () => {
        expect(configId('g', { temperature: 0 })).not.toBe(configId('g', { temperature: 0.1 }))
    })

    it('does not collide across prefixes', { timeout: 120_000 }, () => {
        expect(configId('r', { a: 1 })).not.toBe(configId('g', { a: 1 }))
    })

    it('distinguishes a number from its string form', { timeout: 120_000 }, () => {
        // Both would render as "0.7" in a report; hashing the JSON keeps them apart, so a config
        // written with a quoted number does not silently resume another run's results.
        expect(configId('g', { temperature: 0.7 })).not.toBe(configId('g', { temperature: '0.7' }))
    })
})

describe('expandRetrieval', () => {
    const grid = {
        embeddingModel: ['small', 'large'],
        maxChunkSize: [500, 700, 1000],
        chunkOverlap: [100, 200],
        topK: [5, 8],
    }

    it('expands every combination and gives each a distinct id', { timeout: 120_000 }, () => {
        const configs = expandRetrieval(grid)
        expect(configs).toHaveLength(2 * 3 * 2 * 2)
        expect(new Set(configs.map((c) => c.configId)).size).toBe(configs.length)
    })

    it('groups configurations that share an embedded index', { timeout: 120_000 }, () => {
        // topK is applied at query time, so the two topK variants reuse one index. That halves the
        // embedding cost of this grid, which is the whole reason the grouping exists.
        const groups = groupByIndex(expandRetrieval(grid))
        expect(groups.size).toBe(2 * 3 * 2)
        for (const bucket of groups.values()) expect(bucket).toHaveLength(2)
    })

    it('keys an index on the settings that change its vectors, and nothing else', { timeout: 120_000 }, () => {
        const base = { embeddingModel: 'small', maxChunkSize: 700, chunkOverlap: 100 }
        expect(indexKey(base)).toBe(indexKey({ ...base }))
        expect(indexKey(base)).not.toBe(indexKey({ ...base, maxChunkSize: 500 }))
    })
})

describe('expandGeneration', () => {
    it('treats samples as a repeat count, not a grid dimension', { timeout: 120_000 }, () => {
        const configs = expandGeneration({
            model: ['a', 'b'],
            temperature: [0, 0.7],
            topP: [1],
            maxOutputTokens: [1200],
            systemPrompt: ['p.md'],
            samples: 3,
        })
        expect(configs).toHaveLength(4)
        expect(Object.keys(configs[0]!)).not.toContain('samples')
    })
})
