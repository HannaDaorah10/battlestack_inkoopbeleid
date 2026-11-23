/**
 * Money helpers for the inkoopbeleid module.
 *
 * The domain stores `bigint` cents and never floats, so the only place a decimal exists is at
 * the edge where a human types or reads euros. These two functions ARE that edge; nothing else
 * in the UI should multiply or divide by 100.
 */

/** Format cents for display, e.g. `3000000` -> `€ 30.000,00` in Dutch. */
export function formatCents(cents: number | null | undefined, locale = 'nl'): string {
    if (cents === null || cents === undefined || !Number.isFinite(cents)) return '-'
    return new Intl.NumberFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
    }).format(cents / 100)
}

/**
 * Convert a euro amount from an input field to integer cents.
 *
 * `Math.round` is not cosmetic here: `30000.55 * 100` is `3000054.9999999995` in binary
 * floating point, and truncating that loses a cent on amounts that look exact to the user.
 */
export function eurosToCents(euros: number | null | undefined): number {
    if (euros === null || euros === undefined || !Number.isFinite(euros)) return 0
    return Math.round(euros * 100)
}

/** Inverse of {@link eurosToCents}, for pre-filling an input from a stored amount. */
export function centsToEuros(cents: number | null | undefined): number | null {
    if (cents === null || cents === undefined || !Number.isFinite(cents)) return null
    return cents / 100
}

/**
 * Render a threshold tier's range, e.g. `€ 100.000,00 - € 500.000,00` or `€ 2.000.000,00 en hoger`.
 * `maxAmountCents` is exclusive, matching the half-open tiers in the rule engine.
 */
export function formatRange(
    minCents: number,
    maxCents: number | null,
    locale: string,
    noUpperBoundLabel: string,
): string {
    const min = formatCents(minCents, locale)
    return maxCents === null ? `${min} ${noUpperBoundLabel}` : `${min} - ${formatCents(maxCents, locale)}`
}
