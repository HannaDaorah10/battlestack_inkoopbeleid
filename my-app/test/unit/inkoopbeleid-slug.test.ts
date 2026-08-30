import { describe, expect, it } from 'vitest'
import { slugify } from '#server/utils/inkoopbeleid/slug'

describe('slugify', () => {
    it('lowercases and hyphenates a plain name', () => {
        expect(slugify('Welbions')).toBe('welbions')
        expect(slugify('Woningstichting Ons Huis')).toBe('woningstichting-ons-huis')
    })

    it('strips diacritics instead of dropping the letter', () => {
        expect(slugify('Wéltévreden')).toBe('weltevreden')
    })

    it('collapses punctuation and trims leading/trailing hyphens', () => {
        expect(slugify('  Welbions B.V.!  ')).toBe('welbions-b-v')
    })

    it('is stable for names that only differ by case or whitespace', () => {
        expect(slugify('Ons Huis')).toBe(slugify('  ONS   Huis  '))
    })

    it('falls back to a generated slug when nothing slug-safe survives', () => {
        const slug = slugify('!!!')
        expect(slug).toMatch(/^org-[0-9a-f]{8}$/)
    })
})
