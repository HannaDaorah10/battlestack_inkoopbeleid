/**
 * The fixed 10-section template every real inkoopbeleid follows.
 *
 * Shared by the seed (`seeds/005-inkoopbeleid.ts`) and the create-policy route, so a policy
 * created through the UI has exactly the same skeleton as a seeded one. Import-free and free
 * of Nitro helpers on purpose: the seed runner executes outside Nitro, where auto-imports and
 * `useRuntimeConfig()` do not exist.
 *
 * `key` is what code addresses and `number` is what a reader cites. Both are stable; the Dutch
 * `title` here is only the initial value written into the row, which an author may then edit.
 */

export interface PolicyChapterTemplate {
    number: number
    key: string
    title: string
}

export const POLICY_CHAPTER_TEMPLATE: readonly PolicyChapterTemplate[] = [
    { number: 1, key: 'toepassing', title: 'Toepassing' },
    { number: 2, key: 'opdrachtgeverschap', title: 'Opdrachtgeverschap' },
    { number: 3, key: 'inkoopdoelen', title: 'Inkoopdoelen' },
    { number: 4, key: 'beleidskaders', title: 'Inkoopbeleidskaders en spelregels' },
    { number: 5, key: 'categoriemanagement', title: 'Categoriemanagement' },
    { number: 6, key: 'procedures', title: 'Procedures, drempelbedragen en werkwijze' },
    { number: 7, key: 'inkooporganisatie', title: 'Inkooporganisatie' },
    { number: 8, key: 'realisatie', title: 'Realisatie van doelstellingen' },
    { number: 9, key: 'inkoopproces', title: 'Inkoopproces en overgangsperiode' },
    { number: 10, key: 'bijlagen', title: 'Bijlagen' },
] as const

/** Total chapters a complete policy has. Used by the completeness signal. */
export const POLICY_CHAPTER_COUNT = POLICY_CHAPTER_TEMPLATE.length
