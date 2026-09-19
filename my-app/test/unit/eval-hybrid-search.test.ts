import { describe, expect, it } from 'vitest'
import { MemoryKeywordStore, tokenise } from '../../tools/eval/src/keyword-store'
import { addChunk, createStore, searchStore } from '../../tools/eval/src/search'
import type { StoredChunk } from '../../tools/eval/src/vector-store'

function chunk(text: string, source = 'beleid'): StoredChunk {
    return { text, title: 'Inkoopbeleid', source }
}

describe('tokenise', () => {
    it('folds an amount to one term however the document wrote it', { timeout: 120_000 }, () => {
        // The whole reason hybrid search is worth measuring on this corpus: PDFs write the same
        // threshold three different ways.
        expect(tokenise('EUR 250.000')).toEqual(tokenise('EUR 250 000'))
        expect(tokenise('EUR 250.000')).toEqual(tokenise('eur 250000'))
    })

    it('drops Dutch function words', { timeout: 120_000 }, () => {
        expect(tokenise('het aantal offertes voor de opdracht')).toEqual(['aantal', 'offertes', 'opdracht'])
    })

    it('drops single characters, which carry no retrieval signal', { timeout: 120_000 }, () => {
        expect(tokenise('a b offerte')).toEqual(['offerte'])
    })
})

describe('MemoryKeywordStore', () => {
    it('ranks the chunk containing the literal amount first', { timeout: 120_000 }, () => {
        const store = new MemoryKeywordStore()
        store.add(chunk('Inkoop draagt bij aan de doelen van de organisatie.'))
        store.add(chunk('Bij bedragen van EUR 250.000 en hoger geldt categoriemanagement.'))

        const hits = store.query('Wat geldt er bij EUR 250.000?', 5)
        expect(hits[0]!.chunk.text).toContain('250.000')
    })

    it('finds nothing when no term matches', { timeout: 120_000 }, () => {
        const store = new MemoryKeywordStore()
        store.add(chunk('Bij bedragen van EUR 250.000 geldt categoriemanagement.'))
        expect(store.query('vakantiedagen', 5)).toEqual([])
    })

    it('returns nothing for a question made only of stopwords', { timeout: 120_000 }, () => {
        const store = new MemoryKeywordStore()
        store.add(chunk('Bij bedragen van EUR 250.000 geldt categoriemanagement.'))
        expect(store.query('en van het', 5)).toEqual([])
    })

    it('prefers a chunk matching more distinct terms over one repeating a single term', { timeout: 120_000 }, () => {
        const store = new MemoryKeywordStore()
        store.add(chunk('offerte offerte offerte offerte'))
        store.add(chunk('Voor deze offerte geldt een drempelbedrag.'))

        const hits = store.query('offerte drempelbedrag', 5)
        expect(hits[0]!.chunk.text).toContain('drempelbedrag')
    })
})

describe('searchStore', () => {
    /** Vectors are hand-built so "which chunk does dense rank first" is decided, not incidental. */
    function storeWithChunks() {
        const store = createStore()
        addChunk(store, [1, 0], chunk('Inkoop draagt bij aan verduurzaming en betaalbaarheid.', 'doelen'))
        addChunk(store, [0, 1], chunk('Vanaf EUR 250.000 geldt volledig categoriemanagement.', 'drempels'))
        return store
    }

    it('dense mode returns the vector ranking untouched', { timeout: 120_000 }, () => {
        const hits = searchStore(storeWithChunks(), {
            vector: [1, 0],
            question: 'Wat geldt vanaf EUR 250.000?',
            mode: 'dense',
            topK: 2,
        })
        expect(hits[0]!.chunk.source).toBe('doelen')
    })

    it('hybrid mode lets the keyword path rescue the chunk dense ranked second', { timeout: 120_000 }, () => {
        // Same query vector as above - dense still prefers "doelen" - but the question's literal
        // terms only appear in "drempels", so fusion promotes it.
        const hits = searchStore(storeWithChunks(), {
            vector: [1, 0],
            question: 'Wat geldt vanaf EUR 250.000 aan categoriemanagement?',
            mode: 'hybrid',
            topK: 2,
        })
        expect(hits[0]!.chunk.source).toBe('drempels')
    })

    it('hybrid mode still returns chunks the keyword path never saw', { timeout: 120_000 }, () => {
        const hits = searchStore(storeWithChunks(), {
            vector: [1, 0],
            question: 'iets waar geen enkel woord van voorkomt',
            mode: 'hybrid',
            topK: 2,
        })
        expect(hits.map((h) => h.chunk.source)).toContain('doelen')
    })

    it('never returns more than topK', { timeout: 120_000 }, () => {
        const hits = searchStore(storeWithChunks(), {
            vector: [1, 0],
            question: 'categoriemanagement verduurzaming',
            mode: 'hybrid',
            topK: 1,
        })
        expect(hits).toHaveLength(1)
        expect(hits[0]!.rank).toBe(1)
    })
})
