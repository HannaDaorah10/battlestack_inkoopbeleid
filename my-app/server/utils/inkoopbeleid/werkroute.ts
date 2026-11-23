import { eq } from 'drizzle-orm'
import { BOUWSTEEN_INKOOPBELEID } from '#shared/werkinstructies/bouwsteen-0-2'
import { StepCheckKind, policies } from '#server/database/schema/inkoopbeleid'
import type { UitwerkingVeld, WerkinstructieStap } from '#shared/werkinstructies/types'
import { db } from '#server/database/client'
import type { Policy } from '#server/database/schema/inkoopbeleid'

/**
 * Serverkant van de begeleide route: alles wat de routes moeten weten voordat ze schrijven.
 *
 * De kern hier is dat de content de autoriteit is, niet de client. Een `stepKey` of `fieldKey`
 * die niet in `shared/werkinstructies/` voorkomt, wordt geweigerd. Zonder die controle zou de
 * tabel langzaam vollopen met sleutels van hernoemde of nooit bestaande onderdelen, en zou het
 * afrondscherm ("welke onderdelen zijn gevuld?") gaan liegen over werk dat nergens meer op
 * scherm staat.
 *
 * Deze module is niet generiek over bouwstenen, en dat is bewust: de applicatie kent er nu een.
 * De content is wel generiek, dus een tweede bouwsteen betekent hier hooguit dat
 * `BOUWSTEEN_INKOOPBELEID` een lijst wordt.
 */

/** De stap met deze sleutel, of `undefined`. */
export function vindStap(stepKey: string): WerkinstructieStap | undefined {
    return BOUWSTEEN_INKOOPBELEID.stappen.find((s) => s.id === stepKey)
}

/** Het uitwerking-onderdeel met deze sleutel binnen deze stap, of `undefined`. */
export function vindVeld(stepKey: string, fieldKey: string): UitwerkingVeld | undefined {
    return vindStap(stepKey)?.uitwerking.find((v) => v.id === fieldKey)
}

/** De stap, of een 400 als de client een sleutel stuurde die de werkinstructie niet kent. */
export function requireStap(stepKey: string): WerkinstructieStap {
    const stap = vindStap(stepKey)
    if (!stap) {
        throw createError({ statusCode: 400, statusMessage: `Unknown step: ${stepKey}` })
    }
    return stap
}

/** Het onderdeel, of een 400. Zie {@link requireStap}. */
export function requireVeld(stepKey: string, fieldKey: string): UitwerkingVeld {
    requireStap(stepKey)
    const veld = vindVeld(stepKey, fieldKey)
    if (!veld) {
        throw createError({
            statusCode: 400,
            statusMessage: `Unknown field: ${stepKey}/${fieldKey}`,
        })
    }
    return veld
}

/**
 * Het onderdeel als herhaalbaar onderdeel, of een 400.
 *
 * Een gespreksverslag hangen aan een gewoon tekstveld zou een item opleveren dat nooit ergens
 * wordt getoond, want alleen de lijstvariant rendert items.
 */
export function requireHerhaalbaarVeld(stepKey: string, fieldKey: string): UitwerkingVeld {
    const veld = requireVeld(stepKey, fieldKey)
    if (!veld.herhaalbaar) {
        throw createError({
            statusCode: 400,
            statusMessage: `Field is not repeatable: ${stepKey}/${fieldKey}`,
        })
    }
    return veld
}

/** Hoeveel items de gevraagde checklist van deze stap heeft. Begrenst `itemIndex`. */
export function checklistLengte(stap: WerkinstructieStap, kind: StepCheckKind): number {
    return kind === StepCheckKind.Input
        ? stap.benodigdeInput.length
        : stap.controlevragen.length
}

/**
 * De sectiesleutels van het richtvragen-sjabloon van een herhaalbaar onderdeel.
 *
 * Gebruikt om `policy_step_items.answers` te schonen: alleen sleutels die het sjabloon kent
 * worden bewaard. Anders kan een client willekeurige jsonb in de rij schrijven.
 */
export function sjabloonSleutels(veld: UitwerkingVeld): Set<string> {
    return new Set(veld.herhaalbaar?.sjabloon.secties.map((s) => s.key) ?? [])
}

/** Het inkoopbeleid, of een 404. */
export async function requirePolicy(id: string): Promise<Policy> {
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1)
    if (!policy) {
        throw createError({ statusCode: 404, statusMessage: 'Policy not found' })
    }
    return policy
}
