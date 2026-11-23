import { describe, expect, it } from 'vitest'
import { MemoryVectorStore } from '../../tools/eval/src/vector-store'
import { stripJsonComments } from '../../tools/eval/src/cli'
import { cellKey, completedCells } from '../../tools/eval/src/store'
import { isRetryable } from '../../tools/eval/src/pool'
import { samplingParams } from '../../tools/eval/src/gateway'

function chunk(text: string) {
    return { text, title: 'doc', source: 'doc' }
}

describe('MemoryVectorStore', () => {
    it('ranks by cosine similarity, not by vector magnitude', { timeout: 120_000 }, () => {
        const store = new MemoryVectorStore()
        // Same direction as the query but a hundred times longer. Cosine ignores length, so this
        // must not outrank a shorter vector pointing the same way.
        store.add([100, 0], chunk('long, same direction'))
        store.add([1, 0], chunk('short, same direction'))
        store.add([0, 1], chunk('orthogonal'))

        const hits = store.query([1, 0], 3)
        expect(hits[0]!.score).toBeCloseTo(1, 10)
        expect(hits[1]!.score).toBeCloseTo(1, 10)
        expect(hits[2]!.chunk.text).toBe('orthogonal')
        expect(hits[2]!.score).toBeCloseTo(0, 10)
    })

    it('numbers hits from 1 and respects topK', { timeout: 120_000 }, () => {
        const store = new MemoryVectorStore()
        store.add([1, 0], chunk('a'))
        store.add([0.9, 0.1], chunk('b'))
        store.add([0, 1], chunk('c'))

        const hits = store.query([1, 0], 2)
        expect(hits.map((h) => h.rank)).toEqual([1, 2])
        expect(hits.map((h) => h.chunk.text)).toEqual(['a', 'b'])
    })

    it('breaks ties by insertion order so runs are reproducible', { timeout: 120_000 }, () => {
        const store = new MemoryVectorStore()
        store.add([1, 0], chunk('first'))
        store.add([1, 0], chunk('second'))

        expect(store.query([1, 0], 2).map((h) => h.chunk.text)).toEqual(['first', 'second'])
    })

    it('scores a zero vector at zero rather than NaN', { timeout: 120_000 }, () => {
        const store = new MemoryVectorStore()
        store.add([0, 0], chunk('empty'))
        const [hit] = store.query([1, 0], 1)
        expect(hit!.score).toBe(0)
    })

    it('returns everything it has when topK exceeds the corpus', { timeout: 120_000 }, () => {
        const store = new MemoryVectorStore()
        store.add([1, 0], chunk('only'))
        expect(store.query([1, 0], 10)).toHaveLength(1)
        expect(store.size).toBe(1)
    })
})

describe('stripJsonComments', () => {
    it('removes line comments', { timeout: 120_000 }, () => {
        expect(JSON.parse(stripJsonComments('{ "a": 1 // uitleg\n }'))).toEqual({ a: 1 })
    })

    it('leaves a URL inside a string alone', { timeout: 120_000 }, () => {
        const raw = '{ "url": "https://api.sluis.ai/v1" }'
        expect(JSON.parse(stripJsonComments(raw))).toEqual({ url: 'https://api.sluis.ai/v1' })
    })

    it('is not fooled by an escaped quote before a comment token', { timeout: 120_000 }, () => {
        const raw = '{ "a": "hij zei \\"hoi\\"" } // klaar'
        expect(JSON.parse(stripJsonComments(raw))).toEqual({ a: 'hij zei "hoi"' })
    })
})

describe('resume bookkeeping', () => {
    it('treats separate draws of one configuration as separate cells', { timeout: 120_000 }, () => {
        expect(cellKey('g_1', 'q01', 0)).not.toBe(cellKey('g_1', 'q01', 1))
    })

    it('recognises the cells already recorded', { timeout: 120_000 }, () => {
        const done = completedCells([
            { configId: 'g_1', caseId: 'q01', sampleIndex: 0 },
            { configId: 'g_1', caseId: 'q02' },
        ])
        expect(done.has(cellKey('g_1', 'q01', 0))).toBe(true)
        expect(done.has(cellKey('g_1', 'q02', 0))).toBe(true)
        expect(done.has(cellKey('g_1', 'q03', 0))).toBe(false)
    })
})

describe('samplingParams', () => {
    it('omits topP at its neutral value', { timeout: 120_000 }, () => {
        // Anthropic rejects a request carrying both temperature and top_p with a bare
        // "Bad Request". topP 1 excludes nothing, so dropping it costs no behaviour and keeps
        // every Claude model usable in a default sweep.
        expect(samplingParams(0.3, 1)).toEqual({ temperature: 0.3 })
    })

    it('sends topP when it was deliberately set away from 1', { timeout: 120_000 }, () => {
        expect(samplingParams(0.3, 0.8)).toEqual({ temperature: 0.3, topP: 0.8 })
    })

    it('still sends temperature 0', { timeout: 120_000 }, () => {
        // Guards against a falsy check creeping in: 0 is the most-used temperature in a sweep.
        expect(samplingParams(0, 1)).toEqual({ temperature: 0 })
    })
})

describe('isRetryable', () => {
    it('retries rate limits and upstream failures', { timeout: 120_000 }, () => {
        expect(isRetryable({ statusCode: 429 })).toBe(true)
        expect(isRetryable({ status: 503 })).toBe(true)
        expect(isRetryable({ response: { status: 500 } })).toBe(true)
        expect(isRetryable(new Error('fetch failed'))).toBe(true)
    })

    it('does not retry a request the gateway rejected as invalid', { timeout: 120_000 }, () => {
        // Retrying a 400 or a 401 cannot succeed; it only delays the error the operator needs.
        expect(isRetryable({ statusCode: 400 })).toBe(false)
        expect(isRetryable({ statusCode: 401 })).toBe(false)
        expect(isRetryable(new Error('model not found'))).toBe(false)
    })
})
