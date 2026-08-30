import { randomUUID } from 'node:crypto'

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

/**
 * Turn a free-typed organisation name into a URL/slug-safe key.
 *
 * Used only by the self-service organisation flow: hand-picked slugs like `ons-huis` still come
 * from the seed file, but a name typed through the app has to be mechanically reduced instead.
 * Diacritics are stripped (not just dropped) so "Ons Huis" and a name with an accented letter
 * don't collide on an empty-looking difference.
 */
export function slugify(name: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(COMBINING_DIACRITICS, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    // A name that is all punctuation/symbols (no latin letters or digits) slugifies to ''. Rare
    // for a real organisation name, but a unique NOT NULL column can't store it.
    return slug || `org-${randomUUID().slice(0, 8)}`
}
