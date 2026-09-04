import { describe, expect, it } from 'vitest'
import { chunkDocument } from '#server/utils/rag-chunk'

/**
 * `chunkDocument` was lifted out of `ingestText` so the evaluation harness in `tools/eval` can
 * chunk exactly the way the app does while running without a database.
 *
 * Chunk size and overlap are the two knobs a retrieval sweep varies, so these tests pin the
 * behaviour both sides depend on: that the settings are honoured, and that the metadata a
 * retrieved fragment is cited by survives the split.
 */

const POLICY = [
    'Inkoopbeleid Ons Huis 2025-2028.',
    'Voor diensten en leveringen tussen EUR 25.000 en EUR 50.000 vraagt u twee offertes op.',
    'Voor werken boven EUR 2.000.000 geldt categoriemanagement en is de adviseur inkoop verplicht.',
    'Bij afwijking geldt pas toe of leg uit: leg de reden schriftelijk vast.',
].join('\n\n').repeat(6)

describe('chunkDocument', () => {
    it('splits a document into several chunks', { timeout: 120_000 }, async () => {
        const chunks = await chunkDocument({
            text: POLICY,
            title: 'Inkoopbeleid',
            source: 'Inkoopbeleid Ons Huis 2025-2028',
            maxSize: 300,
            overlap: 50,
        })

        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.every((c) => c.text.length > 0)).toBe(true)
    })

    it('makes a smaller maxSize produce more chunks', { timeout: 120_000 }, async () => {
        const [small, large] = await Promise.all([
            chunkDocument({ text: POLICY, title: 't', source: 's', maxSize: 200, overlap: 0 }),
            chunkDocument({ text: POLICY, title: 't', source: 's', maxSize: 900, overlap: 0 }),
        ])

        // The whole premise of sweeping chunk size is that it changes the split. If it did not,
        // every retrieval configuration would silently be the same configuration.
        expect(small.length).toBeGreaterThan(large.length)
    })

    it('carries the caller metadata onto every chunk', { timeout: 120_000 }, async () => {
        const chunks = await chunkDocument({
            text: POLICY,
            title: 'Inkoopbeleid',
            source: 'Inkoopbeleid Ons Huis 2025-2028',
            metadata: { organisatie: 'ons-huis' },
            maxSize: 300,
            overlap: 50,
        })

        // `source` is the literal token the advisor prompt tells the agent to echo as its citation,
        // and `organisatie` is what keeps one tenant's fragments out of another's answers. A chunk
        // that lost either would be unusable at exactly the moment it is retrieved.
        for (const chunk of chunks) {
            expect(chunk.metadata.source).toBe('Inkoopbeleid Ons Huis 2025-2028')
            expect(chunk.metadata.organisatie).toBe('ons-huis')
        }
    })

    it('returns nothing for empty text rather than one empty chunk', { timeout: 120_000 }, async () => {
        expect(await chunkDocument({ text: '', title: 't', source: 's', maxSize: 300, overlap: 50 }))
            .toHaveLength(0)
    })
})
