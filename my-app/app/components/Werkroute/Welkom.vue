<template>
    <div class="mx-auto w-full max-w-[640px] px-6 pt-10 pb-16">
        <p class="ih-kicker">
            {{ t('werkroute.welkom.kicker', {
                kamer: bouwsteen.roomTitle,
                nummer: bouwsteen.number,
            }) }}
        </p>
        <h1 class="mt-1.5 mb-3.5 text-[32px] leading-tight font-semibold tracking-tight text-inkoophuis-navy">
            {{ bouwsteen.title }}
        </h1>
        <p
            v-if="policyTitel"
            class="mb-2.5 text-sm leading-relaxed text-inkoophuis-tekst-stil"
        >
            {{ t('werkroute.welkom.forPolicy', { titel: policyTitel }) }}
        </p>
        <p
            v-for="(alinea, i) in bouwsteen.introductie"
            :key="i"
            class="mb-2.5 text-[14.5px] leading-relaxed text-inkoophuis-tekst"
        >
            {{ alinea }}
        </p>

        <div class="ih-paneel mt-6 mb-6 px-6 py-5.5">
            <p class="ih-kicker-stil mb-3.5">
                {{ t('werkroute.welkom.route', { n: bouwsteen.stappen.length }) }}
            </p>
            <ol class="flex list-none flex-col gap-3.5">
                <li
                    v-for="(stap, i) in bouwsteen.stappen"
                    :key="stap.id"
                    class="flex items-start gap-3"
                >
                    <span class="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-inkoophuis-navy text-xs font-bold text-white">
                        {{ i + 1 }}
                    </span>
                    <span>
                        <span class="block text-[13.5px] leading-snug font-semibold text-inkoophuis-navy">
                            {{ stap.title }}
                        </span>
                        <span class="mt-0.5 block text-[12.5px] leading-relaxed text-inkoophuis-tekst-stil">
                            {{ stap.kern }}
                        </span>
                    </span>
                </li>
            </ol>
        </div>

        <!-- De ene rode knop van dit scherm. Kernprincipe 1 van de handoff: er is altijd
             precies een logische volgende actie. -->
        <div class="flex flex-wrap items-center gap-4">
            <button
                type="button"
                class="ih-knop-primair ih-knop-start"
                :disabled="bezig"
                @click="emit('start')"
            >
                {{ startLabel }}
                <UIcon
                    :name="bezig ? 'i-lucide-loader-circle' : 'i-lucide-arrow-right'"
                    class="size-4"
                    :class="bezig ? 'animate-spin' : ''"
                />
            </button>
            <span class="text-xs text-inkoophuis-tekst-beige">
                {{ t('werkroute.welkom.result', { resultaat: bouwsteen.eindresultaat }) }}
            </span>
        </div>

        <slot name="onder-start" />

        <!-- Hulpmiddelen zijn hier altijd bereikbaar, ook halverwege de route via "Terug".
             De route leidt je langs de stappen; deze blokken zijn wat je tussendoor nodig hebt. -->
        <div class="ih-paneel mt-8 px-6 py-5.5">
            <p class="ih-kicker-stil mb-3.5">
                {{ t('werkroute.welkom.tools') }}
            </p>
            <ul class="flex list-none flex-col gap-1">
                <li
                    v-for="hulpmiddel in hulpmiddelen"
                    :key="hulpmiddel.to"
                >
                    <NuxtLink
                        :to="hulpmiddel.to.replace(':id', policyId ?? '')"
                        class="flex items-start gap-3 rounded-xl px-3 py-2.5 no-underline hover:bg-inkoophuis-vlak"
                    >
                        <UIcon
                            :name="hulpmiddel.icon"
                            class="mt-0.5 size-4 shrink-0 text-inkoophuis-tekst-stil"
                        />
                        <span class="min-w-0">
                            <span class="block text-[13px] font-semibold text-inkoophuis-navy">
                                {{ hulpmiddel.label }}
                            </span>
                            <span class="block text-[12px] leading-relaxed text-inkoophuis-tekst-stil">
                                {{ hulpmiddel.beschrijving }}
                            </span>
                        </span>
                    </NuxtLink>
                </li>
            </ul>
        </div>

        <slot name="onder" />
    </div>
</template>

<script setup lang="ts">
import type { Bouwsteen } from '#shared/werkinstructies/types'

const props = defineProps<{
    bouwsteen: Bouwsteen
    /** Het beleid waar dit welkomscherm bij hoort. Leeg zolang er nog geen beleid gekozen is. */
    policyId?: string
    policyTitel?: string
    /** De tekst op de rode knop; de ouder weet of het "starten" of "verder gaan" is. */
    startLabel: string
    /** De knop is bezig, bijvoorbeeld met het aanmaken van een beleid. */
    bezig?: boolean
}>()

const emit = defineEmits<{ start: [] }>()

const { t } = useI18n()

/**
 * Zonder gekozen beleid vallen de hulpmiddelen weg die een beleid in hun pad nodig hebben.
 * Een link naar `/dashboard/inkoopbeleid//` is erger dan geen link.
 */
const hulpmiddelen = computed(() =>
    props.bouwsteen.hulpmiddelen.filter((h) => props.policyId || !h.to.includes(':id')),
)
</script>
