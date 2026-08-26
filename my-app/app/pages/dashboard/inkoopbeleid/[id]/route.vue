<template>
    <div class="flex min-h-full flex-col bg-inkoophuis-pagina">
        <!-- Kop van de bouwsteen. Blijft staan in beide weergaven, zodat de gebruiker altijd
             ziet bij welk inkoopbeleid hij aan het werk is. -->
        <header class="flex flex-wrap items-center justify-between gap-3 border-b border-inkoophuis-lijn bg-white px-6 py-3.5">
            <!-- Halverwege de route gaat "terug" naar het welkomscherm van de bouwsteen, van
                 daaruit naar het beleid zelf. Zo blijven de hulpmiddelen op het welkomscherm
                 onderweg bereikbaar zonder de route te verlaten. -->
            <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[13px] font-medium text-inkoophuis-tekst-stil"
                @click="terug"
            >
                <UIcon
                    name="i-lucide-arrow-left"
                    class="size-3.5"
                />
                {{ gestart ? t('werkroute.backToWelcome') : t('werkroute.backToPolicy') }}
            </button>
            <div class="flex flex-wrap items-center gap-2.5">
                <span
                    v-if="bewaarLabel"
                    class="text-[11.5px] text-inkoophuis-tekst-beige"
                >{{ bewaarLabel }}</span>
                <span class="text-xs text-inkoophuis-tekst-stil">{{ policyTitel }}</span>
                <span class="inline-flex rounded-full border border-inkoophuis-navy/20 bg-inkoophuis-navy/5 px-2.5 py-1 text-[11px] font-bold text-inkoophuis-navy">
                    {{ t('werkroute.level', { niveau: bouwsteen.niveau }) }}
                </span>
            </div>
        </header>

        <div
            v-if="status === 'pending' && !data"
            class="flex flex-1 items-center justify-center py-24 text-[13px] text-inkoophuis-tekst-stiller"
        >
            {{ t('werkroute.loading') }}
        </div>

        <WerkrouteWelkom
            v-else-if="!gestart"
            :bouwsteen="bouwsteen"
            :policy-id="policyId"
            :policy-titel="policyTitel"
            :hervatten="hervatten"
            @start="gestart = true"
        />

        <div
            v-else
            class="flex min-h-0 flex-1 flex-col lg:flex-row"
        >
            <WerkrouteReisbalk
                :bouwsteen="bouwsteen"
                :stap-index="stapIndex"
                :scherm-index="schermIndex"
                :schermen="schermen"
                :percentage="percentage"
                @ga="gaMetBewaren"
            />

            <main class="min-w-0 flex-1 overflow-auto px-6 pt-9 pb-16">
                <div class="mx-auto flex w-full max-w-[1080px] items-start gap-6.5">
                    <div class="min-w-0 flex-1 xl:max-w-[620px]">
                        <div class="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                            <p class="text-xs text-inkoophuis-tekst-beige">
                                <span class="font-bold text-inkoophuis-rood">{{ t('werkroute.youAreHere') }}</span>
                                {{ t('werkroute.position', {
                                    stap: stapIndex + 1,
                                    totaal: bouwsteen.stappen.length,
                                    scherm: scherm.label,
                                }) }}
                            </p>
                            <button
                                type="button"
                                class="rounded-full border border-inkoophuis-lijn bg-white px-3 py-1 text-[11px] font-semibold text-inkoophuis-navy xl:hidden"
                                @click="ladeOpen = true"
                            >
                                {{ t('werkroute.instructie.button') }}
                            </button>
                        </div>

                        <WerkrouteTaakkaart
                            :stap="stap"
                            :scherm="scherm"
                            :tekst="huidigeTekst"
                            :gesprekken="huidigeGesprekken"
                            :gesprek-bezig="gesprekBezig"
                            :heeft-vorige="heeftVorige"
                            :heeft-volgende="heeftVolgende"
                            :laatste-van-stap="laatsteVanStap"
                            :policy-id="policyId"
                            :is-aangevinkt="isAangevinkt"
                            :is-veld-gevuld="isVeldGevuld"
                            :aantal-aangevinkt="aantalAangevinkt"
                            @vorige="naarVorige"
                            @volgende="naarVolgende"
                            @tekst="opTekst"
                            @vink="opVink"
                            @voeg-gesprek-toe="opVoegGesprekToe"
                            @verwijder-gesprek="opVerwijderGesprek"
                            @wijzig-gesprek="werkGesprekBij"
                        >
                            <template #afronden-extra>
                                <!-- De route beweegt het beleid ook echt vooruit: de status van
                                     deze stap is dezelfde enum als `policies.status`. De knop
                                     verschijnt alleen als de overgang volgens de bestaande
                                     workflowregels mag, zodat die regels op een plek blijven. -->
                                <div
                                    v-if="statusVolgende"
                                    class="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-inkoophuis-lijn px-4 py-3.5"
                                >
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[12.5px] font-semibold text-inkoophuis-navy">
                                            {{ t('werkroute.status.heading') }}
                                        </p>
                                        <p class="text-[11.5px] leading-relaxed text-inkoophuis-tekst-stil">
                                            {{ t('werkroute.status.body', {
                                                huidig: t(`inkoopbeleid.status.${data?.policy.status}`),
                                                volgende: t(`inkoopbeleid.status.${statusVolgende}`),
                                            }) }}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        class="ih-knop-secundair"
                                        :disabled="statusBezig"
                                        @click="zetStatus(statusVolgende)"
                                    >
                                        {{ t('werkroute.status.action', {
                                            status: t(`inkoopbeleid.status.${statusVolgende}`),
                                        }) }}
                                    </button>
                                </div>
                            </template>
                        </WerkrouteTaakkaart>
                    </div>

                    <!-- Vanaf xl staat het paneel gewoon in de flow; daaronder wordt het een
                         uitschuiflade, precies zoals het responsieve gedrag in de handoff. -->
                    <aside class="sticky top-6 hidden max-h-[calc(100vh-3rem)] w-[300px] shrink-0 flex-col xl:flex">
                        <WerkrouteInstructiePaneel
                            :stap="stap"
                            :scherm-soort="scherm.soort"
                        />
                    </aside>
                </div>
            </main>
        </div>

        <USlideover
            v-model:open="ladeOpen"
            :title="t('werkroute.instructie.button')"
        >
            <template #content>
                <div class="flex h-full flex-col bg-inkoophuis-pagina p-4">
                    <WerkrouteInstructiePaneel
                        :stap="stap"
                        :scherm-soort="scherm.soort"
                        sluitbaar
                        @sluit="ladeOpen = false"
                    />
                </div>
            </template>
        </USlideover>
    </div>
</template>

<script setup lang="ts">
import type { Positie } from '#shared/werkinstructies/schermen'
import type { CheckSoort } from '~/composables/useWerkroute'

definePageMeta({ fullBleed: true })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const policyId = computed(() => String(route.params.id))

const {
    bouwsteen,
    data,
    status,
    refresh,
    stapIndex,
    schermIndex,
    stap,
    schermen,
    scherm,
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
} = await useWerkroute(policyId)

const policyTitel = computed(() => data.value?.policy.title ?? '')

useHead({ title: () => `${bouwsteen.title} · ${policyTitel.value}` })

// --- Welkomscherm versus werkruimte -------------------------------------------------------
const gestart = ref(false)

/**
 * Is er al werk gedaan? Dan heet de knop "hervatten".
 *
 * Kijkt naar de opgeslagen inhoud en niet naar de bewaarde schermpositie: iemand die de route
 * even opende en meteen wegklikte is niet halverwege, en zou anders een knop krijgen die iets
 * belooft wat er niet is.
 */
const hervatten = computed(
    () => bouwsteen.stappen.some((s) => gevuldeOnderdelen(s) > 0),
)

function terug() {
    if (gestart.value) {
        gestart.value = false
        return
    }
    void router.push(`/dashboard/inkoopbeleid/${policyId.value}`)
}

// --- Huidige scherm -----------------------------------------------------------------------
const huidigVeld = computed(() =>
    scherm.value.soort === 'taak' ? stap.value.uitwerking[scherm.value.taakIndex ?? 0] : undefined,
)

const huidigeTekst = computed(() =>
    huidigVeld.value ? tekst(stap.value.id, huidigVeld.value.id) : '',
)

const huidigeGesprekken = computed(() =>
    huidigVeld.value ? gesprekkenVoor(stap.value.id, huidigVeld.value.id) : [],
)

const laatsteVanStap = computed(() => schermIndex.value >= schermen.value.length - 1)

function opTekst(waarde: string) {
    if (!huidigVeld.value) return
    zetTekst(stap.value.id, huidigVeld.value.id, waarde)
}

function opVink(soort: CheckSoort, index: number, aan: boolean) {
    void zetVinkje(stap.value.id, soort, index, aan)
}

/**
 * Navigeren schrijft eerst weg wat nog in een debounce-timer staat.
 *
 * Zonder dat verliest iemand die typt en meteen doorklikt de laatste 800 milliseconden werk,
 * en dat is precies het moment waarop je het minst verwacht iets kwijt te raken.
 */
async function naarVolgende() {
    await bewaarAllesNu()
    volgende()
}

async function naarVorige() {
    await bewaarAllesNu()
    vorige()
}

const bewaarLabel = computed(() => {
    if (bewaarStatus.value === 'bezig') return t('werkroute.saving')
    if (bewaarStatus.value === 'bewaard') return t('werkroute.saved')
    if (bewaarStatus.value === 'mislukt') return t('werkroute.saveFailed')
    return ''
})

// --- Gesprekken ---------------------------------------------------------------------------
const gesprekBezig = ref(false)

async function opVoegGesprekToe() {
    if (!huidigVeld.value || gesprekBezig.value) return
    gesprekBezig.value = true
    try {
        await voegGesprekToe(stap.value.id, huidigVeld.value.id)
    } catch (e) {
        meldFout(e)
    } finally {
        gesprekBezig.value = false
    }
}

async function opVerwijderGesprek(itemId: string) {
    try {
        await verwijderGesprek(itemId)
    } catch (e) {
        meldFout(e)
    }
}

// --- Status van het inkoopbeleid ----------------------------------------------------------
/**
 * De status waar deze stap naartoe leidt, als die overgang nu is toegestaan.
 *
 * Twee voorwaarden: het beleid staat in de status van de huidige stap (anders zou het
 * afrondscherm van stap 1 aanbieden om een beleid dat al in "bespreken" staat terug te zetten),
 * en de volgende stap staat in `allowedTransitions` van de server.
 */
const statusVolgende = computed<string | null>(() => {
    const huidig = data.value?.policy.status
    if (!huidig || huidig !== stap.value.status) return null
    const volgendeStap = bouwsteen.stappen[stapIndex.value + 1]
    if (!volgendeStap) return null
    return data.value?.allowedTransitions.includes(volgendeStap.status)
        ? volgendeStap.status
        : null
})

const statusBezig = ref(false)

async function zetStatus(naar: string | null) {
    if (!naar) return
    statusBezig.value = true
    try {
        await $fetch(`/api/inkoopbeleid/policies/${policyId.value}/status`, {
            method: 'PUT',
            body: { status: naar },
        })
        await refresh()
        toast.add({
            title: t('inkoopbeleid.status.changed', { status: t(`inkoopbeleid.status.${naar}`) }),
            color: 'success',
        })
    } catch (e) {
        meldFout(e)
    } finally {
        statusBezig.value = false
    }
}

// --- Werkinstructie op smalle schermen ----------------------------------------------------
const ladeOpen = ref(false)
watch(scherm, () => (ladeOpen.value = false))

function meldFout(e: unknown) {
    toast.add({
        title: t('werkroute.error'),
        description: serverErrorMessage(e, t('werkroute.error')),
        color: 'error',
        duration: 0,
    })
}

/** Navigatie via de reisbalk bewaart net zo goed als de knoppen in de kaartvoet. */
async function gaMetBewaren(naar: Positie) {
    await bewaarAllesNu()
    ga(naar)
}
</script>
