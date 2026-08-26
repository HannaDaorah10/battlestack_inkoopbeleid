<template>
    <div class="ih-kaart">
        <!-- Start van de stap -->
        <div
            v-if="scherm.soort === 'intro'"
            class="px-8 pt-[30px] pb-[26px]"
        >
            <p class="ih-kicker">
                {{ t('werkroute.taak.step', { nummer: stap.number }) }}
            </p>
            <h1 class="mt-1.5 mb-3.5 text-[25px] leading-tight font-semibold tracking-tight text-inkoophuis-navy">
                {{ stap.title }}
            </h1>
            <p class="mb-4.5 text-sm leading-relaxed text-inkoophuis-tekst">
                {{ stap.doel[0] }}
            </p>
            <div class="flex flex-col gap-2 rounded-xl bg-inkoophuis-vlak px-4 py-3">
                <p class="text-xs leading-relaxed text-inkoophuis-tekst">
                    <strong class="text-inkoophuis-navy">{{ t('werkroute.taak.inShort') }}</strong>
                    {{ stap.kern }}
                </p>
                <p class="text-xs leading-relaxed text-inkoophuis-tekst">
                    <strong class="text-inkoophuis-navy">{{ t('werkroute.taak.next') }}</strong>
                    {{ stap.vervolg }}
                </p>
            </div>
        </div>

        <!-- Input verzamelen -->
        <div
            v-else-if="scherm.soort === 'input'"
            class="px-8 pt-7 pb-6"
        >
            <h2 class="mb-1.5 text-xl font-semibold text-inkoophuis-navy">
                {{ t('werkroute.taak.inputTitle') }}
            </h2>
            <p class="mb-4 text-[13px] leading-relaxed text-inkoophuis-tekst-stil">
                {{ t('werkroute.taak.inputBody') }}
            </p>
            <ul class="flex list-none flex-col gap-0.5">
                <li
                    v-for="(item, i) in stap.benodigdeInput"
                    :key="i"
                >
                    <label class="flex cursor-pointer items-start gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-inkoophuis-vlak">
                        <input
                            type="checkbox"
                            class="mt-[3px] accent-inkoophuis-rood"
                            :checked="isAangevinkt(stap.id, 'input', i)"
                            @change="emit('vink', 'input', i, ($event.target as HTMLInputElement).checked)"
                        />
                        <span
                            class="text-[13px] leading-relaxed"
                            :class="isAangevinkt(stap.id, 'input', i) ? 'text-inkoophuis-tekst-stiller' : 'text-inkoophuis-tekst'"
                        >{{ item }}</span>
                    </label>
                </li>
            </ul>
        </div>

        <!-- Werkscherm: een onderdeel van het stapdocument -->
        <div
            v-else-if="scherm.soort === 'taak' && veld"
            class="px-8 pt-7 pb-6"
        >
            <p class="ih-kicker-stil">
                {{ t('werkroute.taak.part', { i: (scherm.taakIndex ?? 0) + 1, n: stap.uitwerking.length }) }}
            </p>
            <h2 class="mt-1.5 mb-1 text-xl leading-tight font-semibold text-inkoophuis-navy">
                {{ veld.label }}
            </h2>
            <p
                v-if="veld.hint"
                class="mb-3.5 text-[12.5px] leading-relaxed text-inkoophuis-tekst-stil"
            >
                {{ veld.hint }}
            </p>

            <div
                v-if="aanpak"
                class="ih-blok-aanpak mt-1 mb-3.5 flex gap-2.5"
            >
                <span class="mt-px shrink-0 text-[11px] font-bold tracking-wider text-inkoophuis-navy uppercase">
                    {{ t('werkroute.taak.approach') }}
                </span>
                <span class="text-[12.5px] leading-relaxed text-inkoophuis-tekst">{{ aanpak }}</span>
            </div>

            <!-- Twee varianten van hetzelfde werkscherm: een tekstvak, of de lijst met
                 gespreksverslagen als het onderdeel herhaalbaar is. -->
            <WerkrouteGesprekken
                v-if="veld.herhaalbaar"
                :gesprekken="gesprekken"
                :herhaalbaar="veld.herhaalbaar"
                :bezig="gesprekBezig"
                @voeg-toe="emit('voegGesprekToe')"
                @verwijder="(itemId) => emit('verwijderGesprek', itemId)"
                @wijzig="(itemId, wijziging) => emit('wijzigGesprek', itemId, wijziging)"
            />
            <textarea
                v-else
                class="ih-veld"
                rows="6"
                :value="tekst"
                :placeholder="veld.placeholder ?? t('werkroute.taak.placeholder')"
                :aria-label="veld.label"
                @input="emit('tekst', ($event.target as HTMLTextAreaElement).value)"
            />

            <div
                v-if="tip"
                class="ih-blok-tip mt-3.5 flex gap-2.5"
            >
                <span class="mt-px shrink-0 text-[11px] font-bold text-inkoophuis-rood">
                    {{ t('werkroute.taak.tip') }}
                </span>
                <span class="text-xs leading-relaxed text-inkoophuis-tekst-tip">{{ tip }}</span>
            </div>

            <NuxtLink
                v-if="veld.hulpmiddel"
                :to="hulpmiddelPad(veld.hulpmiddel.to)"
                class="mt-3.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-inkoophuis-navy underline decoration-inkoophuis-rood underline-offset-[3px]"
            >
                <UIcon
                    :name="veld.hulpmiddel.icon"
                    class="size-3.5"
                />
                {{ t('werkroute.taak.tool', { label: veld.hulpmiddel.label }) }}
            </NuxtLink>
        </div>

        <!-- Controleer jezelf -->
        <div
            v-else-if="scherm.soort === 'controle'"
            class="px-8 pt-7 pb-6"
        >
            <h2 class="mb-1.5 text-xl font-semibold text-inkoophuis-navy">
                {{ t('werkroute.taak.checkTitle') }}
            </h2>
            <p class="mb-4 text-[13px] leading-relaxed text-inkoophuis-tekst-stil">
                {{ t('werkroute.taak.checkBody') }}
            </p>
            <ul class="flex list-none flex-col gap-0.5">
                <li
                    v-for="(vraag, i) in stap.controlevragen"
                    :key="i"
                >
                    <label class="flex cursor-pointer items-start gap-2.5 rounded-[9px] px-2 py-1.5 hover:bg-inkoophuis-vlak">
                        <input
                            type="checkbox"
                            class="mt-[3px] accent-inkoophuis-rood"
                            :checked="isAangevinkt(stap.id, 'controle', i)"
                            @change="emit('vink', 'controle', i, ($event.target as HTMLInputElement).checked)"
                        />
                        <span
                            class="text-[13px] leading-relaxed"
                            :class="isAangevinkt(stap.id, 'controle', i) ? 'text-inkoophuis-tekst-stiller' : 'text-inkoophuis-tekst'"
                        >{{ vraag }}</span>
                    </label>
                </li>
            </ul>
        </div>

        <!-- Afronden -->
        <div
            v-else-if="scherm.soort === 'afronden'"
            class="px-8 pt-[30px] pb-[26px]"
        >
            <p class="ih-kicker-groen">
                {{ t('werkroute.taak.doneKicker') }}
            </p>
            <h2 class="mt-1.5 mb-1.5 text-[22px] font-semibold text-inkoophuis-navy">
                {{ t('werkroute.taak.doneTitle', { document: stap.documentTitel }) }}
            </h2>
            <p class="mb-4.5 text-[13px] leading-relaxed text-inkoophuis-tekst-stil">
                {{ t('werkroute.taak.doneBody') }}
            </p>

            <div class="flex flex-col gap-2.5 rounded-xl border border-inkoophuis-lijn bg-inkoophuis-veld px-4.5 py-4">
                <div
                    v-for="veldje in stap.uitwerking"
                    :key="veldje.id"
                    class="flex items-start gap-2.5"
                >
                    <span
                        class="mt-0.5 flex size-[15px] shrink-0 items-center justify-center rounded-full text-white"
                        :class="isVeldGevuld(stap.id, veldje.id) ? 'bg-inkoophuis-groen' : 'bg-inkoophuis-lijn'"
                        aria-hidden="true"
                    >
                        <UIcon
                            v-if="isVeldGevuld(stap.id, veldje.id)"
                            name="i-lucide-check"
                            class="size-2.5"
                        />
                    </span>
                    <span class="text-[12.5px] leading-snug text-inkoophuis-tekst">
                        {{ veldje.label }}
                        <span class="text-inkoophuis-tekst-stiller">
                            {{ isVeldGevuld(stap.id, veldje.id) ? '' : t('werkroute.taak.empty') }}
                        </span>
                    </span>
                </div>
            </div>

            <!-- Kwaliteitscriteria zijn advies, geen poort: de knop hieronder blijft altijd
                 klikbaar. De adviseur beslist zelf of de stap af is; dit is wat hem daarbij
                 helpt, niet wat het voor hem beslist. -->
            <div class="mt-4 rounded-xl bg-inkoophuis-vlak px-4 py-3.5">
                <p class="mb-2 text-[12.5px] font-semibold text-inkoophuis-navy">
                    {{ t('werkroute.taak.quality', {
                        gedaan: aantalControleAangevinkt,
                        totaal: stap.controlevragen.length,
                    }) }}
                </p>
                <ul class="ms-4 flex list-disc flex-col gap-1">
                    <li
                        v-for="(criterium, i) in stap.kwaliteitscriteria"
                        :key="i"
                        class="text-[11.5px] leading-relaxed text-inkoophuis-tekst-stil"
                    >
                        {{ criterium }}
                    </li>
                </ul>
            </div>

            <slot name="afronden-extra" />
        </div>

        <!-- Kaartvoet: precies een logische volgende actie, altijd rechtsonder. -->
        <div class="flex items-center justify-between border-t border-inkoophuis-lijn-zacht bg-inkoophuis-vlak-zacht px-8 py-3.5">
            <button
                type="button"
                class="ih-knop-secundair"
                :disabled="!heeftVorige"
                @click="emit('vorige')"
            >
                <UIcon
                    name="i-lucide-arrow-left"
                    class="size-3.5"
                />
                {{ t('werkroute.back') }}
            </button>
            <button
                v-if="heeftVolgende"
                type="button"
                class="ih-knop-primair"
                @click="emit('volgende')"
            >
                {{ volgendeLabel }}
                <UIcon
                    name="i-lucide-arrow-right"
                    class="size-3.5"
                />
            </button>
            <span
                v-else
                class="ih-kicker-groen inline-flex items-center gap-1.5"
            >
                <UIcon
                    name="i-lucide-check"
                    class="size-3.5"
                />
                {{ t('werkroute.taak.finished') }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { WerkinstructieStap } from '#shared/werkinstructies/types'
import type { Scherm } from '#shared/werkinstructies/schermen'
import { aanpakVoorTaak, tipVoorTaak } from '#shared/werkinstructies/schermen'
import type { CheckSoort, WerkrouteGesprek } from '~/composables/useWerkroute'

const props = defineProps<{
    stap: WerkinstructieStap
    scherm: Scherm
    /** De tekst van het huidige werkscherm. Leeg voor de andere schermsoorten. */
    tekst: string
    gesprekken: WerkrouteGesprek[]
    gesprekBezig?: boolean
    heeftVorige: boolean
    heeftVolgende: boolean
    /** Laatste scherm van de stap? Dan luidt de knop anders. */
    laatsteVanStap: boolean
    policyId: string
    isAangevinkt: (stepKey: string, soort: CheckSoort, index: number) => boolean
    isVeldGevuld: (stepKey: string, fieldKey: string) => boolean
    aantalAangevinkt: (stepKey: string, soort: CheckSoort, totaal: number) => number
}>()

const emit = defineEmits<{
    vorige: []
    volgende: []
    tekst: [waarde: string]
    vink: [soort: CheckSoort, index: number, aan: boolean]
    voegGesprekToe: []
    verwijderGesprek: [itemId: string]
    wijzigGesprek: [itemId: string, wijziging: { title?: string, answers?: Record<string, string> }]
}>()

const { t } = useI18n()

const veld = computed(() =>
    props.scherm.soort === 'taak' ? props.stap.uitwerking[props.scherm.taakIndex ?? 0] : undefined,
)

const aanpak = computed(() =>
    props.scherm.soort === 'taak' ? aanpakVoorTaak(props.stap, props.scherm.taakIndex ?? 0) : '',
)

const tip = computed(() =>
    props.scherm.soort === 'taak' ? tipVoorTaak(props.stap, props.scherm.taakIndex ?? 0) : '',
)

const aantalControleAangevinkt = computed(() =>
    props.aantalAangevinkt(props.stap.id, 'controle', props.stap.controlevragen.length),
)

/**
 * De knoptekst hangt af van waar in de reeks je staat.
 *
 * Vier varianten, precies zoals de handoff: starten, doorgaan binnen de stap, doorgaan naar de
 * volgende stap, en de bouwsteen afronden. De knop moet de gebruiker vertellen waar hij heen
 * gaat, niet alleen dat er iets volgt.
 */
const volgendeLabel = computed(() => {
    if (props.scherm.soort === 'intro') return t('werkroute.taak.startStep')
    if (props.laatsteVanStap) return t('werkroute.taak.nextStep')
    return t('werkroute.next')
})

/** `:id` in een hulpmiddelpad invullen met dit beleid. */
function hulpmiddelPad(pad: string): string {
    return pad.replace(':id', props.policyId)
}
</script>
