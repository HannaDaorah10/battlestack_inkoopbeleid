import { BOUWSTEEN_INKOOPBELEID } from '#shared/werkinstructies/bouwsteen-0-2'
import type { Bouwsteen, WerkinstructieStap } from '#shared/werkinstructies/types'
import {
    schermenVoorStap,
    volgendePositie,
    voortgangPercentage,
    vorigePositie,
} from '#shared/werkinstructies/schermen'
import type { Positie, Scherm } from '#shared/werkinstructies/schermen'

/**
 * De begeleide route van een inkoopbeleid: waar de gebruiker is, wat er is ingevuld, en hoe dat
 * bewaard wordt.
 *
 * De schermlogica staat niet hier maar in `shared/werkinstructies/schermen.ts`, zodat de vorm van
 * de route los te testen is van Vue en van de database. Deze composable doet drie dingen die daar
 * niet horen: ophalen, bewaren, en onthouden waar iemand gebleven was.
 */

export interface WerkrouteGesprek {
    id: string
    stepKey: string
    fieldKey: string
    sortOrder: number
    title: string
    answers: Record<string, string>
}

interface StappenResponse {
    policy: {
        id: string
        title: string
        status: string
        version: number
        organisationId: string
    }
    allowedTransitions: string[]
    entries: { stepKey: string, fieldKey: string, content: string, updatedAt: string }[]
    checks: { stepKey: string, checkKind: string, itemIndex: number, checked: boolean }[]
    items: WerkrouteGesprek[]
}

export type CheckSoort = 'input' | 'controle'

/** Hoe lang na de laatste toetsaanslag er bewaard wordt. */
const BEWAAR_VERTRAGING_MS = 800

function entryKey(stepKey: string, fieldKey: string): string {
    return `${stepKey}::${fieldKey}`
}

function checkKey(stepKey: string, soort: CheckSoort, index: number): string {
    return `${stepKey}::${soort}::${index}`
}

export async function useWerkroute(policyId: MaybeRefOrGetter<string>) {
    const bouwsteen: Bouwsteen = BOUWSTEEN_INKOOPBELEID
    const id = computed(() => toValue(policyId))

    const headers = useRequestHeaders(['cookie'])
    const { data, status, refresh } = await useAsyncData<StappenResponse>(
        () => `werkroute-${id.value}`,
        () => $fetch(`/api/inkoopbeleid/policies/${id.value}/stappen`, { headers }),
        { watch: [id] },
    )

    // --- Wat er is ingevuld ---------------------------------------------------------------
    // Lokale kopie naast de server-data: de tekstvakken zijn `v-model`-gebonden en moeten
    // reageren op de toetsaanslag, niet pas op het antwoord van de server.
    const teksten = ref<Record<string, string>>({})
    const vinkjes = ref<Set<string>>(new Set())
    const gesprekken = ref<WerkrouteGesprek[]>([])

    watch(data, (nieuw) => {
        if (!nieuw) return
        const kaart: Record<string, string> = {}
        for (const e of nieuw.entries) kaart[entryKey(e.stepKey, e.fieldKey)] = e.content
        teksten.value = kaart
        vinkjes.value = new Set(
            nieuw.checks.map((c) => checkKey(c.stepKey, c.checkKind as CheckSoort, c.itemIndex)),
        )
        gesprekken.value = [...nieuw.items]
    }, { immediate: true })

    // --- Waar de gebruiker is -------------------------------------------------------------
    /**
     * De stap waar het beleid volgens zijn status in staat.
     *
     * `policies.status` kent dezelfde vijf stappen, dus de route hoort te openen waar het beleid
     * werkelijk is. Zonder dit begint een halfvoltooid traject elke keer weer bij stap 1.
     */
    const stapVanStatus = computed(() => {
        const i = bouwsteen.stappen.findIndex((s) => s.status === data.value?.policy.status)
        return i === -1 ? 0 : i
    })

    const gestart = ref(false)
    // Meteen op de stap van de status, niet pas in `onMounted`. De status is er al tijdens het
    // serverrenderen, dus anders tekent de server stap 1 en springt de pagina bij hydratie
    // zichtbaar door naar de echte stap.
    const stapIndex = ref(stapVanStatus.value)
    const schermIndex = ref(0)

    const positie = computed<Positie>(() => ({
        stapIndex: stapIndex.value,
        schermIndex: schermIndex.value,
    }))

    /**
     * De laatste positie van deze gebruiker, in `localStorage`.
     *
     * Bewust niet in de database: waar iemand in het scherm stond is een gemak voor die ene
     * browser, geen eigenschap van het beleid. Twee adviseurs die aan hetzelfde beleid werken
     * horen elkaars cursor niet te verslepen. Alles wat wel gedeeld moet zijn, de ingevulde
     * tekst en de vinkjes, staat wel op de server.
     */
    const opslagSleutel = computed(() => `werkroute:positie:${id.value}`)

    /** Verfijnt de startpositie met wat deze browser onthouden heeft. Client-only. */
    function herstelPositie() {
        try {
            const rauw = window.localStorage.getItem(opslagSleutel.value)
            if (!rauw) return
            const bewaard = JSON.parse(rauw) as Partial<Positie>
            const stap = bouwsteen.stappen[bewaard.stapIndex ?? -1]
            if (!stap) return
            stapIndex.value = bewaard.stapIndex ?? 0
            schermIndex.value = Math.min(
                Math.max(bewaard.schermIndex ?? 0, 0),
                schermenVoorStap(stap).length - 1,
            )
        } catch {
            // Onleesbare of geblokkeerde opslag is geen fout: dan begint de route bij de stap
            // die de status aanwijst, wat sowieso het redelijke startpunt is.
        }
    }

    function bewaarPositie() {
        if (!import.meta.client) return
        try {
            window.localStorage.setItem(
                opslagSleutel.value,
                JSON.stringify({ stapIndex: stapIndex.value, schermIndex: schermIndex.value }),
            )
        } catch {
            // Zie `herstelPositie`.
        }
    }

    onMounted(herstelPositie)
    watch([stapIndex, schermIndex], bewaarPositie)

    // --- Afgeleide schermstaat ------------------------------------------------------------
    const stap = computed<WerkinstructieStap>(
        () => bouwsteen.stappen[stapIndex.value] ?? bouwsteen.stappen[0]!,
    )
    const schermen = computed<Scherm[]>(() => schermenVoorStap(stap.value))
    const scherm = computed<Scherm>(
        () => schermen.value[Math.min(schermIndex.value, schermen.value.length - 1)]!,
    )
    const percentage = computed(() => voortgangPercentage(bouwsteen, positie.value))
    const heeftVolgende = computed(() => volgendePositie(bouwsteen, positie.value) !== null)
    const heeftVorige = computed(() => vorigePositie(bouwsteen, positie.value) !== null)

    function ga(naar: Positie) {
        stapIndex.value = naar.stapIndex
        schermIndex.value = naar.schermIndex
    }

    function volgende() {
        const naar = volgendePositie(bouwsteen, positie.value)
        if (naar) ga(naar)
    }

    function vorige() {
        const naar = vorigePositie(bouwsteen, positie.value)
        if (naar) ga(naar)
    }

    // --- Bewaren --------------------------------------------------------------------------
    const bewaarStatus = ref<'rustig' | 'bezig' | 'bewaard' | 'mislukt'>('rustig')
    const timers = new Map<string, ReturnType<typeof setTimeout>>()

    function tekst(stepKey: string, fieldKey: string): string {
        return teksten.value[entryKey(stepKey, fieldKey)] ?? ''
    }

    /**
     * Een onderdeel bijwerken en na een korte stilte bewaren.
     *
     * Per onderdeel een eigen timer, niet een globale: wie tussen twee werkschermen heen en weer
     * springt en in beide iets aanpast, mag geen van beide bewerkingen verliezen doordat de
     * tweede de timer van de eerste overschrijft.
     */
    function zetTekst(stepKey: string, fieldKey: string, waarde: string) {
        const sleutel = entryKey(stepKey, fieldKey)
        teksten.value = { ...teksten.value, [sleutel]: waarde }

        clearTimeout(timers.get(sleutel))
        timers.set(sleutel, setTimeout(() => {
            timers.delete(sleutel)
            void bewaarTekst(stepKey, fieldKey, waarde)
        }, BEWAAR_VERTRAGING_MS))
    }

    async function bewaarTekst(stepKey: string, fieldKey: string, content: string) {
        bewaarStatus.value = 'bezig'
        try {
            await $fetch(`/api/inkoopbeleid/policies/${id.value}/stappen/entry`, {
                method: 'PUT',
                body: { stepKey, fieldKey, content },
            })
            bewaarStatus.value = 'bewaard'
        } catch {
            bewaarStatus.value = 'mislukt'
        }
    }

    /** Alles wat nog in een timer wacht meteen wegschrijven. Voor het verlaten van een scherm. */
    async function bewaarAllesNu() {
        const wachtend = [...timers.entries()]
        timers.clear()
        await Promise.all(wachtend.map(([sleutel, timer]) => {
            clearTimeout(timer)
            const [stepKey, fieldKey] = sleutel.split('::')
            if (!stepKey || !fieldKey) return Promise.resolve()
            return bewaarTekst(stepKey, fieldKey, teksten.value[sleutel] ?? '')
        }))
    }

    function isAangevinkt(stepKey: string, soort: CheckSoort, index: number): boolean {
        return vinkjes.value.has(checkKey(stepKey, soort, index))
    }

    async function zetVinkje(stepKey: string, soort: CheckSoort, index: number, aan: boolean) {
        const sleutel = checkKey(stepKey, soort, index)
        const volgende = new Set(vinkjes.value)
        if (aan) volgende.add(sleutel)
        else volgende.delete(sleutel)
        vinkjes.value = volgende

        try {
            await $fetch(`/api/inkoopbeleid/policies/${id.value}/stappen/check`, {
                method: 'PUT',
                body: { stepKey, checkKind: soort, itemIndex: index, checked: aan },
            })
        } catch {
            // Terugdraaien: een vinkje dat blijft staan terwijl de server het niet heeft, is
            // erger dan een vinkje dat wegspringt. De checklist is waar een adviseur op afgaat
            // om een stap af te ronden.
            const terug = new Set(vinkjes.value)
            if (aan) terug.delete(sleutel)
            else terug.add(sleutel)
            vinkjes.value = terug
            bewaarStatus.value = 'mislukt'
        }
    }

    /** Hoeveel items van een checklist zijn afgevinkt. */
    function aantalAangevinkt(stepKey: string, soort: CheckSoort, totaal: number): number {
        let n = 0
        for (let i = 0; i < totaal; i++) if (isAangevinkt(stepKey, soort, i)) n++
        return n
    }

    // --- Gesprekken (de herhaalbare onderdelen) -------------------------------------------
    function gesprekkenVoor(stepKey: string, fieldKey: string): WerkrouteGesprek[] {
        return gesprekken.value
            .filter((g) => g.stepKey === stepKey && g.fieldKey === fieldKey)
            .sort((a, b) => a.sortOrder - b.sortOrder)
    }

    async function voegGesprekToe(stepKey: string, fieldKey: string) {
        const nieuw = await $fetch<WerkrouteGesprek>(
            `/api/inkoopbeleid/policies/${id.value}/stappen/gesprek`,
            { method: 'POST', body: { stepKey, fieldKey } },
        )
        gesprekken.value = [...gesprekken.value, nieuw]
        return nieuw
    }

    async function verwijderGesprek(itemId: string) {
        await $fetch(`/api/inkoopbeleid/policies/${id.value}/stappen/gesprek`, {
            method: 'DELETE',
            body: { itemId },
        })
        gesprekken.value = gesprekken.value.filter((g) => g.id !== itemId)
    }

    function werkGesprekBij(itemId: string, wijziging: { title?: string, answers?: Record<string, string> }) {
        gesprekken.value = gesprekken.value.map((g) =>
            g.id === itemId
                ? {
                        ...g,
                        ...(wijziging.title !== undefined ? { title: wijziging.title } : {}),
                        ...(wijziging.answers ? { answers: { ...g.answers, ...wijziging.answers } } : {}),
                    }
                : g,
        )

        const sleutel = `gesprek::${itemId}::${wijziging.title !== undefined ? 'title' : Object.keys(wijziging.answers ?? {}).join(',')}`
        clearTimeout(timers.get(sleutel))
        timers.set(sleutel, setTimeout(async () => {
            timers.delete(sleutel)
            bewaarStatus.value = 'bezig'
            try {
                await $fetch(`/api/inkoopbeleid/policies/${id.value}/stappen/gesprek`, {
                    method: 'PUT',
                    body: { itemId, ...wijziging },
                })
                bewaarStatus.value = 'bewaard'
            } catch {
                bewaarStatus.value = 'mislukt'
            }
        }, BEWAAR_VERTRAGING_MS))
    }

    // --- Voortgang per stap ---------------------------------------------------------------
    /**
     * Of een onderdeel van het stapdocument gevuld is.
     *
     * Voor een herhaalbaar onderdeel telt "er is minstens een gesprek" als gevuld: het onderdeel
     * heeft geen eigen tekstvak, dus zonder deze regel zou zo'n onderdeel op het afrondscherm
     * altijd leeg blijven staan, ook na tien gespreksverslagen.
     */
    function isVeldGevuld(stepKey: string, fieldKey: string): boolean {
        const veld = bouwsteen.stappen
            .find((s) => s.id === stepKey)
            ?.uitwerking.find((v) => v.id === fieldKey)
        if (veld?.herhaalbaar) return gesprekkenVoor(stepKey, fieldKey).length > 0
        return tekst(stepKey, fieldKey).trim().length > 0
    }

    /** Hoeveel onderdelen van een stap gevuld zijn. Voedt het afrondscherm en de reisbalk. */
    function gevuldeOnderdelen(s: WerkinstructieStap): number {
        return s.uitwerking.filter((v) => isVeldGevuld(s.id, v.id)).length
    }

    return {
        bouwsteen,
        data,
        status,
        refresh,

        gestart,
        stapIndex,
        schermIndex,
        stap,
        schermen,
        scherm,
        positie,
        percentage,
        heeftVolgende,
        heeftVorige,
        ga,
        volgende,
        vorige,

        bewaarStatus,
        tekst,
        zetTekst,
        bewaarAllesNu,
        isAangevinkt,
        zetVinkje,
        aantalAangevinkt,

        gesprekkenVoor,
        voegGesprekToe,
        verwijderGesprek,
        werkGesprekBij,

        isVeldGevuld,
        gevuldeOnderdelen,
    }
}
