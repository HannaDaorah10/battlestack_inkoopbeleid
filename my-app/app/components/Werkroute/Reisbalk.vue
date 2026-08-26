<template>
    <nav
        class="ih-reisbalk w-full shrink-0 overflow-y-auto px-5 py-6 lg:w-60"
        :aria-label="t('werkroute.reisbalk.label')"
    >
        <p class="mb-1 text-[10px] font-bold tracking-[0.18em] text-white/45 uppercase">
            {{ t('werkroute.reisbalk.heading') }}
        </p>

        <!-- Voortgang over de hele bouwsteen, niet over deze stap: de balk hoort te
             antwoorden op "hoe ver ben ik in het traject", niet op "hoe ver in dit scherm". -->
        <div
            class="mb-4 h-1 overflow-hidden rounded-full bg-white/15"
            role="progressbar"
            :aria-valuenow="percentage"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="t('werkroute.reisbalk.progress')"
        >
            <div
                class="h-full bg-inkoophuis-rood transition-[width] duration-300"
                :style="{ width: `${percentage}%` }"
            />
        </div>

        <ol class="flex list-none flex-col">
            <li
                v-for="(s, i) in bouwsteen.stappen"
                :key="s.id"
                class="relative pb-1.5"
            >
                <button
                    type="button"
                    class="flex w-full cursor-pointer items-start gap-2.5 border-none bg-transparent py-1.5 text-left"
                    :aria-current="i === stapIndex ? 'step' : undefined"
                    @click="emit('ga', { stapIndex: i, schermIndex: 0 })"
                >
                    <span
                        class="flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold"
                        :class="cirkelKlassen(i)"
                        aria-hidden="true"
                    >
                        <UIcon
                            v-if="i < stapIndex"
                            name="i-lucide-check"
                            class="size-3"
                        />
                        <template v-else>{{ i + 1 }}</template>
                    </span>
                    <span>
                        <span
                            class="block text-[12.5px] leading-tight font-semibold"
                            :class="i === stapIndex ? 'text-white' : i < stapIndex ? 'text-white/75' : 'text-white/45'"
                        >{{ s.title }}</span>
                        <span class="mt-px block text-[10.5px] text-white/40">
                            {{ statusTekst(i) }}
                        </span>
                    </span>
                </button>

                <!-- De subroute hangt alleen onder de stap waar de gebruiker in zit. Alle
                     schermen van alle stappen tegelijk tonen zou de balk onleesbaar maken. -->
                <ul
                    v-if="i === stapIndex"
                    class="mt-0.5 mb-1.5 ml-[11px] flex list-none flex-col gap-[3px] border-l border-white/15 pl-[22px]"
                >
                    <li
                        v-for="(scherm, j) in schermen"
                        :key="`${s.id}-${j}`"
                    >
                        <button
                            type="button"
                            class="flex cursor-pointer items-center gap-[7px] border-none bg-transparent py-0.5 text-left"
                            :aria-current="j === schermIndex ? 'true' : undefined"
                            @click="emit('ga', { stapIndex: i, schermIndex: j })"
                        >
                            <span
                                class="size-[7px] shrink-0 rounded-full"
                                :class="j < schermIndex ? 'bg-inkoophuis-groen' : j === schermIndex ? 'bg-inkoophuis-rood' : 'bg-white/25'"
                                aria-hidden="true"
                            />
                            <span
                                class="text-[11px] leading-tight"
                                :class="j === schermIndex ? 'text-white' : 'text-white/50'"
                            >{{ scherm.label }}</span>
                        </button>
                    </li>
                </ul>
            </li>
        </ol>
    </nav>
</template>

<script setup lang="ts">
import type { Bouwsteen } from '#shared/werkinstructies/types'
import type { Positie, Scherm } from '#shared/werkinstructies/schermen'

const props = defineProps<{
    bouwsteen: Bouwsteen
    stapIndex: number
    schermIndex: number
    /** De schermen van de huidige stap; alleen die krijgt een uitgeklapte subroute. */
    schermen: Scherm[]
    percentage: number
}>()

const emit = defineEmits<{ ga: [positie: Positie] }>()

const { t } = useI18n()

/**
 * De drie toestanden van een stapcirkel.
 *
 * "Afgerond" is hier positie-in-de-route en niet inhoudelijke volledigheid: de gebruiker is
 * voorbij deze stap. Kwaliteitscriteria zijn bewust advies en geen poort, dus de balk mag niet
 * doen alsof een stap pas telt als alles is afgevinkt.
 */
function cirkelKlassen(i: number): string {
    if (i < props.stapIndex) return 'border-inkoophuis-groen bg-inkoophuis-groen text-white'
    if (i === props.stapIndex) return 'border-inkoophuis-rood bg-inkoophuis-rood text-white'
    return 'border-white/30 bg-transparent text-white/50'
}

function statusTekst(i: number): string {
    if (i < props.stapIndex) return t('werkroute.reisbalk.done')
    if (i === props.stapIndex) return t('werkroute.reisbalk.busy')
    return t('werkroute.reisbalk.todo')
}
</script>
