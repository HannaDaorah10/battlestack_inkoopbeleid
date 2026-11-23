import { and, eq, sql } from 'drizzle-orm'
import { BOUWSTEEN_INKOOPBELEID } from '#shared/werkinstructies/bouwsteen-0-2'
import type { db } from '#server/database/client'
import { policyChapters, policyStepEntries } from '#server/database/schema/inkoopbeleid'

/**
 * De brug tussen de begeleide route en de hoofdstukken van het beleid.
 *
 * Een onderdeel uit de werkinstructie kan met `hoofdstuk` naar een hoofdstuk wijzen (stap 0.2.3
 * doet dat voor zeven van de tien hoofdstukken). Wat de adviseur daar invult, wordt de tekst van
 * dat hoofdstuk. Zonder deze brug liep de route volledig langs het beleid heen: na vijf stappen
 * meldde de route "Concept-inkoopbeleid staat klaar" en stond het beleid op 0 van 10 hoofdstukken.
 *
 * De ene regel die hier telt: een hoofdstuk dat iemand los heeft bewerkt, wordt nooit
 * overschreven. Het hoofdstuk volgt de route zolang het leeg is of nog precies de vorige tekst
 * van het onderdeel bevat. Zodra iemand het hoofdstuk zelf aanpast (of de AI-schrijver het
 * vult), is dat de leidende tekst en laat de route het met rust.
 */

type Db = typeof db
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Executor = Db | Tx

/** Zet de nieuwe tekst van een onderdeel door naar zijn hoofdstuk, als dat nog mag. */
export async function schrijfOnderdeelNaarHoofdstuk(exec: Executor, input: {
    policyId: string
    chapterKey: string
    vorigeInhoud: string
    nieuweInhoud: string
}): Promise<void> {
    await exec
        .update(policyChapters)
        .set({ contentMarkdown: input.nieuweInhoud, updatedAt: new Date() })
        .where(and(
            eq(policyChapters.policyId, input.policyId),
            eq(policyChapters.key, input.chapterKey),
            sql`(btrim(${policyChapters.contentMarkdown}) = '' or ${policyChapters.contentMarkdown} = ${input.vorigeInhoud})`,
        ))
}

/** Alle onderdelen die naar een hoofdstuk wijzen, als (stap, onderdeel, hoofdstuk). */
export function routeHoofdstukKoppelingen(): { stepKey: string, fieldKey: string, chapterKey: string }[] {
    return BOUWSTEEN_INKOOPBELEID.stappen.flatMap((stap) =>
        stap.uitwerking
            .filter((veld) => veld.hoofdstuk)
            .map((veld) => ({ stepKey: stap.id, fieldKey: veld.id, chapterKey: veld.hoofdstuk! })),
    )
}

/**
 * Vult lege hoofdstukken met wat de route er al voor heeft. Raakt gevulde hoofdstukken niet aan.
 *
 * Voor beleid dat de route al had doorlopen voordat de brug bestond, en als vangnet bij het
 * afronden van het opstellen: zo staat na stap 0.2.3 het concept ook echt in het beleid.
 */
export async function vulLegeHoofdstukkenUitRoute(exec: Executor, policyId: string): Promise<number> {
    const koppelingen = routeHoofdstukKoppelingen()
    if (koppelingen.length === 0) return 0

    const entries = await exec
        .select({
            stepKey: policyStepEntries.stepKey,
            fieldKey: policyStepEntries.fieldKey,
            content: policyStepEntries.content,
        })
        .from(policyStepEntries)
        .where(eq(policyStepEntries.policyId, policyId))

    let gevuld = 0
    for (const k of koppelingen) {
        const entry = entries.find((e) => e.stepKey === k.stepKey && e.fieldKey === k.fieldKey)
        if (!entry || entry.content.trim().length === 0) continue
        const rows = await exec
            .update(policyChapters)
            .set({ contentMarkdown: entry.content, updatedAt: new Date() })
            .where(and(
                eq(policyChapters.policyId, policyId),
                eq(policyChapters.key, k.chapterKey),
                sql`btrim(${policyChapters.contentMarkdown}) = ''`,
            ))
            .returning({ id: policyChapters.id })
        gevuld += rows.length
    }
    return gevuld
}

/**
 * Wat de route heeft opgeleverd, als leesbare tekst voor de AI-schrijver.
 *
 * Alle ingevulde onderdelen van alle stappen, met het label uit de werkinstructie erboven. Het
 * onderdeel dat bij het gevraagde hoofdstuk hoort komt bovenaan, want dat is de kern van wat de
 * adviseur over dit hoofdstuk heeft vastgesteld.
 */
export async function routeAntwoordenVoorHoofdstuk(exec: Executor, input: {
    policyId: string
    chapterKey: string
}): Promise<string> {
    const entries = await exec
        .select({
            stepKey: policyStepEntries.stepKey,
            fieldKey: policyStepEntries.fieldKey,
            content: policyStepEntries.content,
        })
        .from(policyStepEntries)
        .where(eq(policyStepEntries.policyId, input.policyId))

    const blokken: { eerst: boolean, tekst: string }[] = []
    for (const stap of BOUWSTEEN_INKOOPBELEID.stappen) {
        for (const veld of stap.uitwerking) {
            const entry = entries.find((e) => e.stepKey === stap.id && e.fieldKey === veld.id)
            const inhoud = entry?.content.trim()
            if (!inhoud) continue
            blokken.push({
                eerst: veld.hoofdstuk === input.chapterKey,
                tekst: `### Stap ${stap.number} · ${veld.label}\n${inhoud}`,
            })
        }
    }
    return [...blokken.filter((b) => b.eerst), ...blokken.filter((b) => !b.eerst)]
        .map((b) => b.tekst)
        .join('\n\n')
}
