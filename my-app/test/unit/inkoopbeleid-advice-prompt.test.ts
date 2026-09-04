import { describe, expect, it } from 'vitest'
import {
    NO_CONTEXT_NOTICE,
    buildAdvicePrompt,
    formatContextBlock,
} from '#server/utils/inkoopbeleid/advice-prompt'

/**
 * These pin the exact prompt the advisor sends.
 *
 * `/api/inkoopbeleid/advies` and the evaluation harness in `tools/eval` both build their prompt
 * here. If the shape drifts, a sweep tunes a prompt the app does not send - and nothing else in
 * the codebase would notice.
 */

describe('formatContextBlock', () => {
    it('labels each fragment with the source the prompt tells the agent to cite', () => {
        const block = formatContextBlock([
            { title: 'Ons Huis', source: 'Inkoopbeleid Ons Huis 2025-2028', score: 0.8, text: 'Twee offertes.' },
        ])
        expect(block).toBe('--- Fragment 1 | bron: Inkoopbeleid Ons Huis 2025-2028 ---\nTwee offertes.')
    })

    it('numbers fragments from 1 and separates them with a blank line', () => {
        const block = formatContextBlock([
            { title: 'a', source: 'a', score: 1, text: 'eerste' },
            { title: 'b', source: 'b', score: 0.5, text: 'tweede' },
        ])
        expect(block).toContain('Fragment 1')
        expect(block).toContain('Fragment 2')
        expect(block.split('\n\n')).toHaveLength(2)
    })

    it('returns an empty string when nothing was retrieved', () => {
        expect(formatContextBlock([])).toBe('')
    })
})

describe('buildAdvicePrompt', () => {
    it('puts the context first and the question last', () => {
        expect(buildAdvicePrompt({ contextBlock: 'FRAGMENT', question: 'Hoeveel offertes?' }))
            .toBe('Context:\nFRAGMENT\n\nVraag: Hoeveel offertes?')
    })

    it('substitutes the Dutch notice when retrieval came back empty', () => {
        // Answering anyway is deliberate: the agent is instructed to say plainly that the documents
        // do not cover this, which is more useful than an empty-result error and keeps "I do not
        // know" a normal answer.
        const prompt = buildAdvicePrompt({ contextBlock: '', question: 'Welke cao geldt?' })
        expect(prompt).toContain(NO_CONTEXT_NOTICE)
        expect(prompt).toContain('Vraag: Welke cao geldt?')
    })
})
