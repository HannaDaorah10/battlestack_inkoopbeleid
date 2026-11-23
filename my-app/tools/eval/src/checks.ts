import { normaliseWhitespace } from '../../../server/utils/inkoopbeleid/extract'

/**
 * Machine-checkable signals about one answer.
 *
 * These are not a quality score and must not become one - a person decides what is good. They
 * exist because a handful of failures are objectively checkable and, in this domain, matter more
 * than fluency: an advisor that states a threshold the policy does not contain is worse than one
 * that says it does not know, and it is exactly the failure that reads best.
 *
 * Every flag is phrased so a non-technical reviewer can act on it without asking what it means.
 */

export const FLAG_LABELS: Record<string, string> = {
    'bedrag-niet-in-bron': 'Noemt een bedrag dat niet in het beleidsdocument staat',
    'bron-niet-in-corpus': 'Verwijst naar een bron die niet bestaat',
    'geen-context': 'Er zijn geen fragmenten uit het document gevonden',
    'leeg-antwoord': 'Geen antwoord gegeven',
    'afgekapt': 'Antwoord is halverwege afgebroken (te weinig ruimte)',
    'niet-nederlands': 'Antwoord is niet in het Nederlands',
}

/**
 * Fold away everything that makes the same amount look like two different strings.
 *
 * PDF extraction produces "2.000.000", "2 000 000" and "2000000" for one number depending on the
 * document. `normaliseWhitespace` is the app's own function and already unifies the exotic space
 * characters that show up inside amounts; reusing it keeps one definition of "the same text"
 * instead of two that can drift.
 */
export function normaliseForMatch(text: string): string {
    return normaliseWhitespace(text)
        .toLowerCase()
        // Drop separators sitting between digits only, so "30.000" becomes "30000" while
        // "art. 3" keeps its full stop and sentence boundaries survive.
        .replace(/(\d)[.\s](?=\d{3}\b)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
}

export function containsKeyword(haystack: string, keyword: string): boolean {
    const needle = normaliseForMatch(keyword)
    if (!needle) return false
    return normaliseForMatch(haystack).includes(needle)
}

export function containsAllKeywords(haystack: string, keywords: readonly string[]): boolean {
    if (keywords.length === 0) return false
    return keywords.every((k) => containsKeyword(haystack, k))
}

/**
 * The floor for a bare number - no currency symbol, no thousand separators - to count as an amount.
 *
 * Set above the year range on purpose. A procurement policy is dense with years ("Inkoopbeleid Ons
 * Huis 2025-2028", "Inkoopwijzer 2023"), and a correct answer citing its source by name would
 * otherwise be reported as inventing a figure. Amounts written bare and below this are vanishingly
 * rare in these documents; years written bare are on every page.
 */
const BARE_AMOUNT_FLOOR = 10_000

/**
 * Euro amounts in a text, as whole euros.
 *
 * Bare small integers are deliberately not amounts. "2 offertes" and "3 offertes" are the most
 * common numbers in a procurement policy, and counting them would flag every correct answer. A
 * number qualifies when it carries a currency marker, is written with thousand separators, or
 * clears {@link BARE_AMOUNT_FLOOR} on its own.
 */
export function extractAmounts(text: string): Set<number> {
    const out = new Set<number>()
    const normalised = normaliseWhitespace(text)
    const pattern = /(€|eur\b)?\s*(\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,(\d{1,2}))?/gi

    for (const match of normalised.matchAll(pattern)) {
        const currency = match[1]
        const digits = match[2]!
        const grouped = /[.\s]/.test(digits)
        const value = Number(digits.replace(/[.\s]/g, ''))

        if (!Number.isFinite(value)) continue
        if (!currency && !grouped && value < BARE_AMOUNT_FLOOR) continue
        out.add(value)
    }

    return out
}

/** Citations the prompt asks for, e.g. `[bron: Inkoopbeleid Ons Huis]`. */
export function extractCitations(text: string): string[] {
    return [...text.matchAll(/\[([^\]\n]{2,120})\]/g)]
        .map((m) => m[1]!.replace(/^\s*bron\s*:\s*/i, '').trim())
        .filter((s) => s.length > 0)
}

const DUTCH_MARKERS = ['de', 'het', 'een', 'en', 'van', 'voor', 'met', 'niet', 'dat', 'bij', 'aan', 'je', 'zijn', 'wordt', 'moet']
const ENGLISH_MARKERS = ['the', 'and', 'of', 'for', 'with', 'not', 'that', 'you', 'is', 'are', 'this', 'must', 'should']

/**
 * Whether an answer drifted into English.
 *
 * Function-word counting rather than a language library: it is a handful of words, needs no
 * dependency, and only has to separate "clearly Dutch" from "clearly English". Short answers are
 * left alone, because a one-line reply carries too few markers to judge - and a false alarm here
 * costs the reviewer's trust in every other flag.
 */
export function looksEnglish(text: string): boolean {
    const words = text.toLowerCase().match(/[a-z]+/g) ?? []
    if (words.length < 20) return false

    let dutch = 0
    let english = 0
    for (const word of words) {
        if (DUTCH_MARKERS.includes(word)) dutch++
        if (ENGLISH_MARKERS.includes(word)) english++
    }
    return english > dutch
}

export interface AnswerCheckInput {
    answer: string
    /** The question, so an amount the questioner supplied is not reported as invented. */
    question: string
    /** Full text of the documents this question was allowed to search. */
    corpusText: string
    /** Source labels present in that corpus. */
    knownSources: readonly string[]
    grounded: boolean
    finishReason: string | null
}

export function checkAnswer(input: AnswerCheckInput): string[] {
    const flags: string[] = []

    if (input.answer.trim().length === 0) {
        // Every other check would also fire on an empty answer, and none of them would add
        // anything a reviewer can use.
        return ['leeg-antwoord']
    }

    if (!input.grounded) flags.push('geen-context')
    if (input.finishReason === 'length') flags.push('afgekapt')
    if (looksEnglish(input.answer)) flags.push('niet-nederlands')

    // An amount the questioner supplied ("een contract van EUR 30.000") gets echoed back constantly
    // and is not in the policy, because it is a purchase, not a threshold. Excluding the question's
    // own amounts is what keeps this flag about invention rather than about repetition.
    const allowed = new Set([...extractAmounts(input.corpusText), ...extractAmounts(input.question)])
    for (const amount of extractAmounts(input.answer)) {
        if (!allowed.has(amount)) {
            flags.push('bedrag-niet-in-bron')
            break
        }
    }

    const known = input.knownSources.map((s) => normaliseForMatch(s)).filter((s) => s.length > 0)
    for (const citation of extractCitations(input.answer)) {
        const needle = normaliseForMatch(citation)
        if (!needle) continue
        if (!known.some((s) => s.includes(needle) || needle.includes(s))) {
            flags.push('bron-niet-in-corpus')
            break
        }
    }

    return flags
}
