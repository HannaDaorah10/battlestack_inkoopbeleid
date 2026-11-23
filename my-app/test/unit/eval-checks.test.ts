import { describe, expect, it } from 'vitest'
import {
    checkAnswer,
    containsAllKeywords,
    containsKeyword,
    extractAmounts,
    extractCitations,
    looksEnglish,
    normaliseForMatch,
} from '../../tools/eval/src/checks'

describe('normaliseForMatch', () => {
    it('treats the three ways of writing one amount as the same', { timeout: 120_000 }, () => {
        const flat = normaliseForMatch('2000000')
        expect(normaliseForMatch('2.000.000')).toBe(flat)
        expect(normaliseForMatch('2 000 000')).toBe(flat)
    })

    it('leaves a full stop that is not a thousand separator alone', { timeout: 120_000 }, () => {
        expect(normaliseForMatch('artikel 3. Daarna')).toContain('3.')
    })
})

describe('containsKeyword', () => {
    it('matches an amount across formatting differences', { timeout: 120_000 }, () => {
        const fragment = 'Boven de EUR 2.000.000 geldt een aanbestedingsprocedure.'
        expect(containsKeyword(fragment, '2000000')).toBe(true)
        expect(containsKeyword(fragment, '2 000 000')).toBe(true)
    })

    it('is case-insensitive', { timeout: 120_000 }, () => {
        expect(containsKeyword('Meervoudig onderhands', 'MEERVOUDIG ONDERHANDS')).toBe(true)
    })

    it('requires every keyword, not just one', { timeout: 120_000 }, () => {
        const fragment = 'Bij 25.000 tot 50.000 euro vraagt u 2 offertes op.'
        expect(containsAllKeywords(fragment, ['2', '25.000'])).toBe(true)
        expect(containsAllKeywords(fragment, ['2', 'categoriemanagement'])).toBe(false)
    })

    it('reports no match for an empty keyword list', { timeout: 120_000 }, () => {
        // A question with no expected keywords cannot be scored; counting it as a hit would
        // inflate every configuration's recall equally and hide the real differences.
        expect(containsAllKeywords('van alles', [])).toBe(false)
    })
})

describe('extractAmounts', () => {
    it('finds amounts in every notation the documents use', { timeout: 120_000 }, () => {
        const found = extractAmounts('Van EUR 25.000 tot 50.000, en boven 2 000 000.')
        expect(found).toContain(25000)
        expect(found).toContain(50000)
        expect(found).toContain(2000000)
    })

    it('does not treat a quote count as an amount', { timeout: 120_000 }, () => {
        // "2 offertes" and "3 offertes" are the most frequent numbers in a procurement policy.
        // Counting them would flag every correct answer as inventing a figure.
        const found = extractAmounts('U vraagt 2 offertes op, bij werken 3 offertes.')
        expect(found.has(2)).toBe(false)
        expect(found.has(3)).toBe(false)
    })

    it('accepts a small number when it carries a currency marker', { timeout: 120_000 }, () => {
        expect(extractAmounts('een bedrag van € 500')).toContain(500)
    })

    it('does not treat a year as an amount', { timeout: 120_000 }, () => {
        // Policy titles carry years everywhere ("Ons Huis 2025-2028", "Inkoopwijzer 2023"). Reading
        // those as figures would flag a correct answer for citing its own source.
        const found = extractAmounts('Inkoopbeleid Ons Huis 2025-2028, opvolger van 2023.')
        expect(found.has(2025)).toBe(false)
        expect(found.has(2028)).toBe(false)
        expect(found.has(2023)).toBe(false)
    })
})

describe('extractCitations', () => {
    it('reads the bracketed source the prompt asks for', { timeout: 120_000 }, () => {
        expect(extractCitations('Dat volgt uit [bron: Inkoopbeleid Ons Huis].'))
            .toEqual(['Inkoopbeleid Ons Huis'])
    })

    it('accepts a bracket without the bron prefix', { timeout: 120_000 }, () => {
        expect(extractCitations('Zie [Inkoopwijzer 2023].')).toEqual(['Inkoopwijzer 2023'])
    })
})

describe('looksEnglish', () => {
    it('ignores short answers', { timeout: 120_000 }, () => {
        expect(looksEnglish('You need 2 quotes.')).toBe(false)
    })

    it('flags a long answer that switched language', { timeout: 120_000 }, () => {
        const english = 'You must request two quotes for this purchase and you should record '
            + 'the request and the quotes that you receive from the suppliers that are invited.'
        expect(looksEnglish(english)).toBe(true)
    })

    it('leaves a long Dutch answer alone', { timeout: 120_000 }, () => {
        const dutch = 'Voor een schoonmaakcontract van 30.000 euro vraagt u twee offertes op en '
            + 'legt u de offerteaanvraag en de ontvangen offertes vast in het dossier van de inkoop.'
        expect(looksEnglish(dutch)).toBe(false)
    })
})

describe('checkAnswer', () => {
    const corpusText = 'Van EUR 25.000 tot EUR 50.000: 2 offertes. Boven EUR 2.000.000: 3 offertes.'
    const base = {
        question: 'Hoeveel offertes bij een schoonmaakcontract van EUR 30.000?',
        corpusText,
        knownSources: ['Inkoopbeleid Ons Huis 2025-2028'],
        grounded: true,
        finishReason: 'stop' as string | null,
    }

    it('passes a grounded answer that only cites real figures', { timeout: 120_000 }, () => {
        const answer = 'U heeft 2 offertes nodig, want 30.000 valt in de schijf van 25.000 tot '
            + '50.000 euro [bron: Inkoopbeleid Ons Huis 2025-2028].'
        expect(checkAnswer({ ...base, answer })).toEqual([])
    })

    it('flags an amount that appears nowhere in the policy', { timeout: 120_000 }, () => {
        const answer = 'Boven EUR 75.000 heeft u drie offertes nodig.'
        expect(checkAnswer({ ...base, answer })).toContain('bedrag-niet-in-bron')
    })

    it('does not flag the amount the questioner supplied', { timeout: 120_000 }, () => {
        // 30.000 is a purchase, not a threshold, so it is absent from the policy by design.
        const answer = 'Voor 30.000 euro vraagt u 2 offertes op.'
        expect(checkAnswer({ ...base, answer })).not.toContain('bedrag-niet-in-bron')
    })

    it('flags a citation to a document that does not exist', { timeout: 120_000 }, () => {
        const answer = 'Dat staat in [bron: Aanbestedingswet 2012].'
        expect(checkAnswer({ ...base, answer })).toContain('bron-niet-in-corpus')
    })

    it('accepts a citation that names the document loosely', { timeout: 120_000 }, () => {
        const answer = 'Zie [bron: Inkoopbeleid Ons Huis].'
        expect(checkAnswer({ ...base, answer })).not.toContain('bron-niet-in-corpus')
    })

    it('reports a truncated answer and a missing context', { timeout: 120_000 }, () => {
        const flags = checkAnswer({
            ...base,
            answer: 'U heeft 2 offertes nodig omdat',
            grounded: false,
            finishReason: 'length',
        })
        expect(flags).toContain('afgekapt')
        expect(flags).toContain('geen-context')
    })

    it('says only that an empty answer is empty', { timeout: 120_000 }, () => {
        expect(checkAnswer({ ...base, answer: '   ', grounded: false })).toEqual(['leeg-antwoord'])
    })
})
