<template>
    <div class="ih-paneel flex min-h-0 flex-1 flex-col overflow-auto p-[18px]">
        <div class="flex items-baseline justify-between gap-2">
            <p class="ih-kicker text-[10px]">
                {{ t('werkroute.instructie.heading', { nummer: stap.number }) }}
            </p>
            <button
                v-if="sluitbaar"
                type="button"
                class="cursor-pointer border-none bg-transparent px-0.5 text-[13px] font-semibold text-inkoophuis-tekst-stil"
                :aria-label="t('werkroute.instructie.close')"
                @click="emit('sluit')"
            >
                <UIcon
                    name="i-lucide-x"
                    class="size-4"
                />
            </button>
        </div>
        <h3 class="mt-[3px] mb-3.5 text-[15px] font-semibold text-inkoophuis-navy">
            {{ stap.title }}
        </h3>

        <div class="flex flex-col gap-1.5">
            <div
                v-for="sectie in secties"
                :key="sectie.key"
                class="overflow-hidden rounded-xl border border-inkoophuis-lijn-zacht"
            >
                <button
                    type="button"
                    class="flex w-full cursor-pointer items-center justify-between gap-2 border-none px-[13px] py-2.5 text-left"
                    :class="isOpen(sectie.key) ? 'bg-inkoophuis-vlak' : 'bg-white'"
                    :aria-expanded="isOpen(sectie.key)"
                    @click="toggle(sectie.key)"
                >
                    <span class="text-[11.5px] font-bold text-inkoophuis-navy">{{ sectie.titel }}</span>
                    <UIcon
                        :name="isOpen(sectie.key) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="size-3 shrink-0 text-inkoophuis-tekst-stiller"
                    />
                </button>
                <div
                    v-if="isOpen(sectie.key)"
                    class="border-t border-inkoophuis-lijn-zachtst px-[13px] pt-[11px] pb-3"
                >
                    <!-- Alleen de Aanpak is genummerd: dat is een volgorde van handelingen,
                         de andere secties zijn opsommingen zonder volgorde. -->
                    <ol
                        v-if="sectie.genummerd"
                        class="ms-4 flex list-decimal flex-col gap-1.5"
                    >
                        <li
                            v-for="(regel, i) in sectie.items"
                            :key="i"
                            class="text-[11.5px] leading-relaxed text-inkoophuis-tekst"
                        >
                            {{ regel }}
                        </li>
                    </ol>
                    <div v-else>
                        <p
                            v-for="(regel, i) in sectie.items"
                            :key="i"
                            class="mb-1.5 text-[11.5px] leading-relaxed text-inkoophuis-tekst last:mb-0"
                        >
                            {{ regel }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { WerkinstructieStap } from '#shared/werkinstructies/types'
import type { InstructieSectie, SchermSoort } from '#shared/werkinstructies/schermen'
import { sectieVoorScherm } from '#shared/werkinstructies/schermen'

const props = defineProps<{
    stap: WerkinstructieStap
    /** Bepaalt welke sectie automatisch openklapt. */
    schermSoort: SchermSoort
    /** Toont de sluitknop; alleen in de uitschuiflade op smalle schermen. */
    sluitbaar?: boolean
}>()

const emit = defineEmits<{ sluit: [] }>()

const { t } = useI18n()

interface PaneelSectie {
    key: InstructieSectie
    titel: string
    items: string[]
    genummerd?: boolean
}

/**
 * De negen secties van het paneel, in de volgorde die de designhandoff voorschrijft.
 *
 * "Rol en context" bundelt doelgroep, kern en vervolg: drie regels die in de werkinstructie
 * boven het document staan en die je zelden nodig hebt, maar wel moet kunnen nazoeken.
 */
const secties = computed<PaneelSectie[]>(() => [
    { key: 'doel', titel: t('werkroute.instructie.secties.doel'), items: props.stap.doel },
    { key: 'benodigdeInput', titel: t('werkroute.instructie.secties.benodigdeInput'), items: props.stap.benodigdeInput },
    { key: 'aanpak', titel: t('werkroute.instructie.secties.aanpak'), items: props.stap.aanpak, genummerd: true },
    { key: 'resultaat', titel: t('werkroute.instructie.secties.resultaat'), items: [props.stap.resultaatIntro, ...props.stap.resultaat] },
    { key: 'templates', titel: t('werkroute.instructie.secties.templates'), items: [props.stap.templatesTekst] },
    { key: 'aandachtspunten', titel: t('werkroute.instructie.secties.aandachtspunten'), items: props.stap.aandachtspunten },
    { key: 'controlevragen', titel: t('werkroute.instructie.secties.controlevragen'), items: props.stap.controlevragen },
    { key: 'kwaliteitscriteria', titel: t('werkroute.instructie.secties.kwaliteitscriteria'), items: [t('werkroute.instructie.kwaliteitsIntro'), ...props.stap.kwaliteitscriteria] },
    {
        key: 'rolEnContext',
        titel: t('werkroute.instructie.secties.rolEnContext'),
        items: [
            t('werkroute.instructie.doelgroep', { waarde: props.stap.doelgroep }),
            t('werkroute.instructie.kern', { waarde: props.stap.kern }),
            t('werkroute.instructie.vervolg', { waarde: props.stap.vervolg }),
        ],
    },
])

/**
 * Drie toestanden, niet twee: `null` is "volg het scherm", een sleutel is "de gebruiker koos
 * deze sectie", en `'geen'` is "de gebruiker klapte alles dicht".
 *
 * Die derde is nodig omdat de automatisch geopende sectie anders niet te sluiten valt: hem
 * dichtklikken zou `null` opleveren, waarna de automatiek hem meteen weer opent.
 *
 * Bij elke schermwissel terug naar `null`, want dan neemt het paneel weer de sectie die bij het
 * nieuwe scherm hoort. Zonder die reset blijft een handmatige keuze de rest van de route
 * vastzitten, en dan komt de werkinstructie niet meer naar de gebruiker toe.
 */
const handmatig = ref<InstructieSectie | 'geen' | null>(null)
watch(() => props.schermSoort, () => (handmatig.value = null))
watch(() => props.stap.id, () => (handmatig.value = null))

const automatisch = computed(() => sectieVoorScherm(props.schermSoort))

function isOpen(key: InstructieSectie): boolean {
    if (handmatig.value === 'geen') return false
    return (handmatig.value ?? automatisch.value) === key
}

function toggle(key: InstructieSectie) {
    handmatig.value = isOpen(key) ? 'geen' : key
}
</script>
