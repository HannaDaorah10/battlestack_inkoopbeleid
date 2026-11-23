<template>
    <div class="flex flex-col gap-3">
        <div
            v-for="(gesprek, i) in gesprekken"
            :key="gesprek.id"
            class="rounded-xl border border-inkoophuis-lijn bg-inkoophuis-veld"
        >
            <div class="flex items-start justify-between gap-2 border-b border-inkoophuis-lijn-zacht px-4 py-3">
                <div class="min-w-0 flex-1">
                    <label
                        :for="`gesprek-titel-${gesprek.id}`"
                        class="ih-kicker-stil mb-1 block text-[10px]"
                    >
                        {{ t('werkroute.gesprekken.number', { n: i + 1, eenheid: herhaalbaar.eenheid }) }}
                    </label>
                    <input
                        :id="`gesprek-titel-${gesprek.id}`"
                        class="ih-veld ih-veld-kort"
                        type="text"
                        :value="gesprek.title"
                        :placeholder="herhaalbaar.titelPlaceholder"
                        :aria-label="herhaalbaar.titelLabel"
                        @input="emit('wijzig', gesprek.id, { title: ($event.target as HTMLInputElement).value })"
                    />
                </div>
                <button
                    type="button"
                    class="mt-6 shrink-0 cursor-pointer rounded-md border-none bg-transparent p-1.5 text-inkoophuis-tekst-stiller hover:text-inkoophuis-rood"
                    :aria-label="t('werkroute.gesprekken.remove', { eenheid: herhaalbaar.eenheid })"
                    @click="bevestigVerwijderen = gesprek.id"
                >
                    <UIcon
                        name="i-lucide-trash-2"
                        class="size-4"
                    />
                </button>
            </div>

            <div class="flex flex-col gap-3.5 px-4 py-3.5">
                <div
                    v-for="sectie in herhaalbaar.sjabloon.secties"
                    :key="sectie.key"
                >
                    <p class="mb-1 text-[12.5px] font-semibold text-inkoophuis-navy">
                        {{ sectie.titel }}
                    </p>
                    <!-- De richtvragen staan boven het notitieveld, niet in een tooltip: dit is
                         het sjabloon uit de werkinstructie en het hoort tijdens het gesprek
                         leesbaar te zijn zonder ergens op te klikken. -->
                    <ul class="mb-1.5 ms-4 flex list-disc flex-col gap-0.5">
                        <li
                            v-for="(vraag, vi) in sectie.vragen"
                            :key="vi"
                            class="text-[11.5px] leading-relaxed text-inkoophuis-tekst-stil"
                        >
                            {{ vraag }}
                        </li>
                    </ul>
                    <textarea
                        class="ih-veld"
                        rows="3"
                        :value="gesprek.answers[sectie.key] ?? ''"
                        :placeholder="t('werkroute.gesprekken.notePlaceholder')"
                        :aria-label="sectie.titel"
                        @input="emit('wijzig', gesprek.id, { answers: { [sectie.key]: ($event.target as HTMLTextAreaElement).value } })"
                    />
                </div>
            </div>
        </div>

        <p
            v-if="gesprekken.length === 0"
            class="rounded-xl border border-dashed border-inkoophuis-lijn px-4 py-5 text-center text-[12.5px] text-inkoophuis-tekst-stil"
        >
            {{ t('werkroute.gesprekken.empty', { eenheid: herhaalbaar.eenheid.toLowerCase() }) }}
        </p>

        <div>
            <button
                type="button"
                class="ih-knop-secundair"
                :disabled="bezig"
                @click="emit('voegToe')"
            >
                <UIcon
                    name="i-lucide-plus"
                    class="size-3.5"
                />
                {{ t('werkroute.gesprekken.add', { eenheid: herhaalbaar.eenheid.toLowerCase() }) }}
            </button>
        </div>

        <UModal v-model:open="verwijderOpen">
            <template #content>
                <UCard>
                    <template #header>
                        {{ t('werkroute.gesprekken.removeTitle', { eenheid: herhaalbaar.eenheid.toLowerCase() }) }}
                    </template>
                    <p class="text-sm text-muted">
                        {{ t('werkroute.gesprekken.removeBody') }}
                    </p>
                    <template #footer>
                        <div class="flex justify-end gap-2">
                            <UButton
                                color="neutral"
                                variant="outline"
                                @click="bevestigVerwijderen = null"
                            >
                                {{ t('werkroute.cancel') }}
                            </UButton>
                            <UButton
                                color="error"
                                @click="verwijder"
                            >
                                {{ t('werkroute.gesprekken.removeConfirm') }}
                            </UButton>
                        </div>
                    </template>
                </UCard>
            </template>
        </UModal>
    </div>
</template>

<script setup lang="ts">
import type { UitwerkingVeld } from '#shared/werkinstructies/types'
import type { WerkrouteGesprek } from '~/composables/useWerkroute'

defineProps<{
    gesprekken: WerkrouteGesprek[]
    /** De `herhaalbaar`-definitie van dit onderdeel, met het richtvragen-sjabloon. */
    herhaalbaar: NonNullable<UitwerkingVeld['herhaalbaar']>
    /** De ouder doet de fetch en weet dus als enige wanneer die loopt. */
    bezig?: boolean
}>()

const emit = defineEmits<{
    voegToe: []
    verwijder: [itemId: string]
    wijzig: [itemId: string, wijziging: { title?: string, answers?: Record<string, string> }]
}>()

const { t } = useI18n()

/**
 * Verwijderen gaat via een bevestiging, anders dan het toevoegen.
 *
 * Een gespreksverslag is werk van een uur dat nergens anders staat, en de prullenbakknop zit
 * vlak naast het titelveld. Een misklik mag dat niet wissen.
 */
const bevestigVerwijderen = ref<string | null>(null)
const verwijderOpen = computed({
    get: () => bevestigVerwijderen.value !== null,
    set: (open: boolean) => {
        if (!open) bevestigVerwijderen.value = null
    },
})

function verwijder() {
    if (!bevestigVerwijderen.value) return
    emit('verwijder', bevestigVerwijderen.value)
    bevestigVerwijderen.value = null
}
</script>
