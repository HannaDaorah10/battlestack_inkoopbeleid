import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../../tools/eval/src/report/csv'
import { blindLabel, escapeHtml, renderReviewPage } from '../../tools/eval/src/report/html'

describe('toCsv', () => {
    it('separates with semicolons so a Dutch-locale Excel opens it in columns', { timeout: 120_000 }, () => {
        const csv = toCsv([{ a: 1, b: 'x' }], ['a', 'b'])
        expect(csv.split('\r\n')[0]).toBe('a;b')
        expect(csv.split('\r\n')[1]).toBe('1;x')
    })

    it('quotes a field containing the separator', { timeout: 120_000 }, () => {
        expect(toCsv([{ a: 'een; twee' }], ['a'])).toContain('"een; twee"')
    })

    it('doubles an embedded quote', { timeout: 120_000 }, () => {
        expect(toCsv([{ a: 'hij zei "hoi"' }], ['a'])).toContain('"hij zei ""hoi"""')
    })

    it('writes decimals with a comma, matching the separator locale', { timeout: 120_000 }, () => {
        expect(toCsv([{ a: 0.75 }], ['a'])).toContain('0,75')
    })

    it('leaves an empty cell for a missing value', { timeout: 120_000 }, () => {
        expect(toCsv([{ a: null, b: undefined, c: 'x' }], ['a', 'b', 'c'])).toContain(';;x')
    })
})

describe('parseCsv', () => {
    it('round-trips what toCsv wrote, quoting and all', { timeout: 120_000 }, () => {
        const rows = [{ naam: 'Sanne; de Vries', opmerking: 'zei "klopt niet"' }]
        const parsed = parseCsv(toCsv(rows, ['naam', 'opmerking']))
        expect(parsed).toEqual(rows)
    })

    it('strips the byte-order mark Excel writes back', { timeout: 120_000 }, () => {
        const withBom = `${String.fromCharCode(0xFEFF)}a;b\r\n1;2\r\n`
        expect(parseCsv(withBom)).toEqual([{ a: '1', b: '2' }])
    })

    it('keeps a newline inside a quoted comment in one field', { timeout: 120_000 }, () => {
        // A reviewer pressing Enter in the comment box must not become two half rows.
        const raw = 'label;opmerking\r\nA;"regel een\nregel twee"\r\n'
        expect(parseCsv(raw)[0]!.opmerking).toBe('regel een\nregel twee')
    })

    it('ignores a trailing blank line', { timeout: 120_000 }, () => {
        expect(parseCsv('a;b\r\n1;2\r\n\r\n')).toHaveLength(1)
    })

    it('returns nothing for an empty file', { timeout: 120_000 }, () => {
        expect(parseCsv('')).toEqual([])
    })
})

describe('blindLabel', () => {
    it('counts A, B, C', { timeout: 120_000 }, () => {
        expect([0, 1, 25].map(blindLabel)).toEqual(['A', 'B', 'Z'])
    })

    it('keeps going past Z without repeating a label', { timeout: 120_000 }, () => {
        const labels = Array.from({ length: 60 }, (_, i) => blindLabel(i))
        expect(new Set(labels).size).toBe(60)
        expect(labels[26]).toBe('AA')
    })
})

describe('escapeHtml', () => {
    it('neutralises markup from a model answer', { timeout: 120_000 }, () => {
        expect(escapeHtml('<script>alert(1)</script>'))
            .toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    })
})

describe('renderReviewPage', () => {
    const data = {
        sweepName: 'test',
        cases: [
            { id: 'q01', vraag: 'Hoeveel offertes bij EUR 30.000?', organisatie: 'ons-huis', fragmenten: ['Inkoopbeleid Ons Huis'] },
            { id: 'q02', vraag: 'Wie tekent boven EUR 1.000.000?', organisatie: 'ons-huis', fragmenten: [] },
        ],
        answers: [
            { label: 'A', caseId: 'q01', sampleIndex: 0, answer: 'Twee offertes.', error: null, flags: [] },
            { label: 'B', caseId: 'q01', sampleIndex: 0, answer: 'Drie offertes.', error: null, flags: ['bedrag-niet-in-bron'] },
            { label: 'A', caseId: 'q02', sampleIndex: 0, answer: '', error: 'model niet beschikbaar', flags: [] },
            { label: 'B', caseId: 'q02', sampleIndex: 0, answer: 'De directeur-bestuurder.', error: null, flags: [] },
        ],
    }

    it('renders one section per question with every answer', { timeout: 120_000 }, () => {
        const html = renderReviewPage(data)
        expect(html).toContain('Hoeveel offertes bij EUR 30.000?')
        expect(html).toContain('Twee offertes.')
        expect(html).toContain('Drie offertes.')
        expect(html).toContain('De directeur-bestuurder.')
    })

    it('never names a model, only a letter', { timeout: 120_000 }, () => {
        const html = renderReviewPage(data)
        expect(html).toContain('Configuratie A')
        expect(html).toContain('Configuratie B')
        expect(html).not.toContain('gpt')
    })

    it('is byte-identical across renders, so two reviewers see the same order', { timeout: 120_000 }, () => {
        // The order is shuffled per question to cancel position bias; seeding that shuffle is what
        // keeps "the second answer" meaning the same thing for everyone who got the file.
        expect(renderReviewPage(data)).toBe(renderReviewPage(data))
    })

    it('translates a flag into something a non-technical reader can act on', { timeout: 120_000 }, () => {
        expect(renderReviewPage(data)).toContain('Noemt een bedrag dat niet in het beleidsdocument staat')
    })

    it('says plainly when a configuration produced no answer', { timeout: 120_000 }, () => {
        expect(renderReviewPage(data)).toContain('model niet beschikbaar')
    })

    it('warns when retrieval found nothing for a question', { timeout: 120_000 }, () => {
        expect(renderReviewPage(data)).toContain('geen fragmenten in de documenten gevonden')
    })

    it('loads no external resources, so it works offline and leaks nothing', { timeout: 120_000 }, () => {
        const html = renderReviewPage(data)
        expect(html).not.toMatch(/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/i)
    })

    it('escapes markup coming from a model answer', { timeout: 120_000 }, () => {
        const html = renderReviewPage({
            ...data,
            answers: [{ label: 'A', caseId: 'q01', sampleIndex: 0, answer: '<img src=x onerror=alert(1)>', error: null, flags: [] }],
        })
        expect(html).not.toContain('<img src=x')
        expect(html).toContain('&lt;img src=x')
    })
})
