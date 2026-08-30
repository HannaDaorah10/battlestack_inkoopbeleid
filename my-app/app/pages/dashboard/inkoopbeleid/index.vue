<template>
    <OrganisationGate>
        <div class="flex min-h-full flex-col bg-inkoophuis-pagina">
            <!-- Kop: alleen de organisatiekeuze. Geen "terug", want dit is het startpunt van de
             bouwsteen; de zijbalk is de weg naar de rest van de applicatie. -->
            <header class="flex flex-wrap items-center justify-between gap-3 border-b border-inkoophuis-lijn bg-white px-6 py-3.5">
                <label class="flex items-center gap-2.5 text-[12.5px] text-inkoophuis-tekst-stil">
                    <span class="font-semibold text-inkoophuis-navy">{{ t('inkoopbeleid.organisation.label') }}</span>
                    <UInputMenu
                        v-model="selectedOrganisation"
                        :items="organisationItems"
                        :create-item="true"
                        value-key="value"
                        :placeholder="t('inkoopbeleid.organisation.switcherPlaceholder')"
                        :loading="creatingOrganisation"
                        size="sm"
                        class="min-w-52"
                        @create="onCreateOrganisation"
                    />
                </label>
                <span class="inline-flex rounded-full border border-inkoophuis-navy/20 bg-inkoophuis-navy/5 px-2.5 py-1 text-[11px] font-bold text-inkoophuis-navy">
                    {{ t('werkroute.level', { niveau: bouwsteen.niveau }) }}
                </span>
            </header>

            <WerkrouteWelkom
                :bouwsteen="bouwsteen"
                :policy-id="enigBeleid?.id"
                :policy-titel="enigBeleid?.title"
                :start-label="startLabel"
                :bezig="starting"
                @start="start"
            >
                <template #onder-start>
                    <!-- Bij meer dan een beleid staat de keuze open, direct onder de startknop en
                     niet in een modal: de gebruiker moet zien dat er iets te kiezen valt. -->
                    <div
                        v-if="policies.length > 1"
                        class="ih-paneel mt-6 px-6 py-5"
                    >
                        <p class="ih-kicker-stil mb-1">
                            {{ t('werkroute.welkom.chooseTitle') }}
                        </p>
                        <p class="mb-3 text-[12.5px] leading-relaxed text-inkoophuis-tekst-stil">
                            {{ t('werkroute.welkom.chooseBody') }}
                        </p>
                        <ul class="flex list-none flex-col gap-1.5">
                            <li
                                v-for="p in policies"
                                :key="p.id"
                            >
                                <NuxtLink
                                    :to="`/dashboard/inkoopbeleid/${p.id}/route`"
                                    class="flex items-center justify-between gap-3 rounded-xl border border-inkoophuis-lijn px-4 py-3 no-underline hover:bg-inkoophuis-vlak"
                                >
                                    <span class="min-w-0">
                                        <span class="block truncate text-[13px] font-semibold text-inkoophuis-navy">{{ p.title }}</span>
                                        <span class="block text-[11.5px] text-inkoophuis-tekst-stil">
                                            {{ t('werkroute.welkom.policyMeta', {
                                                status: t(`inkoopbeleid.status.${p.status}`),
                                                stap: stapNummerVoor(p.status),
                                                versie: p.version,
                                            }) }}
                                        </span>
                                    </span>
                                    <UIcon
                                        name="i-lucide-arrow-right"
                                        class="size-4 shrink-0 text-inkoophuis-tekst-stiller"
                                    />
                                </NuxtLink>
                            </li>
                        </ul>
                    </div>
                </template>

                <template #onder>
                    <!-- De beleidsdocumenten van deze organisatie: het lijstje dat vroeger de hele
                     pagina was. Het blijft bereikbaar, maar onder de route in plaats van ervoor. -->
                    <div class="ih-paneel mt-6 px-6 py-5.5">
                        <div class="mb-3.5 flex items-center justify-between gap-3">
                            <p class="ih-kicker-stil">
                                {{ t('inkoopbeleid.overview.heading') }}
                            </p>
                            <button
                                type="button"
                                class="ih-knop-secundair"
                                @click="showCreate = true"
                            >
                                <UIcon
                                    name="i-lucide-plus"
                                    class="size-3.5"
                                />
                                {{ t('inkoopbeleid.overview.new') }}
                            </button>
                        </div>

                        <p
                            v-if="policies.length === 0"
                            class="text-[12.5px] leading-relaxed text-inkoophuis-tekst-stil"
                        >
                            {{ t('werkroute.welkom.noPolicyYet') }}
                        </p>
                        <ul
                            v-else
                            class="flex list-none flex-col divide-y divide-inkoophuis-lijn-zacht"
                        >
                            <li
                                v-for="p in policies"
                                :key="p.id"
                                class="flex flex-wrap items-center justify-between gap-2 py-2.5"
                            >
                                <span class="min-w-0">
                                    <NuxtLink
                                        :to="`/dashboard/inkoopbeleid/${p.id}`"
                                        class="text-[13px] font-semibold text-inkoophuis-navy underline decoration-inkoophuis-rood underline-offset-[3px]"
                                    >
                                        {{ p.title }}
                                    </NuxtLink>
                                    <span class="ms-2 text-[11.5px] text-inkoophuis-tekst-stil">
                                        {{ t(`inkoopbeleid.status.${p.status}`) }}
                                        · v{{ p.version }}
                                        · {{ new Date(p.updatedAt).toLocaleDateString(locale) }}
                                    </span>
                                </span>
                                <NuxtLink
                                    :to="`/dashboard/inkoopbeleid/${p.id}/route`"
                                    class="text-[12px] font-semibold text-inkoophuis-navy underline decoration-inkoophuis-rood underline-offset-[3px]"
                                >
                                    {{ t('werkroute.open') }}
                                </NuxtLink>
                            </li>
                        </ul>
                    </div>
                </template>
            </WerkrouteWelkom>

            <UModal v-model:open="showCreate">
                <template #content>
                    <UCard>
                        <template #header>
                            {{ t('inkoopbeleid.overview.createTitle') }}
                        </template>
                        <form
                            class="space-y-3"
                            @submit.prevent="createPolicy()"
                        >
                            <UFormField
                                :label="t('inkoopbeleid.overview.fieldTitle')"
                                required
                            >
                                <UInput
                                    v-model="draft.title"
                                    required
                                    class="w-full"
                                />
                            </UFormField>
                            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <UFormField :label="t('inkoopbeleid.overview.fieldPeriodStart')">
                                    <UInput
                                        v-model="draft.periodStart"
                                        type="date"
                                        class="w-full"
                                    />
                                </UFormField>
                                <UFormField :label="t('inkoopbeleid.overview.fieldPeriodEnd')">
                                    <UInput
                                        v-model="draft.periodEnd"
                                        type="date"
                                        class="w-full"
                                    />
                                </UFormField>
                            </div>
                            <div class="flex justify-end gap-2">
                                <UButton
                                    color="neutral"
                                    variant="outline"
                                    @click="showCreate = false"
                                >
                                    {{ t('inkoopbeleid.cancel') }}
                                </UButton>
                                <UButton
                                    type="submit"
                                    :loading="creating"
                                    :disabled="!draft.title.trim()"
                                >
                                    {{ t('inkoopbeleid.add') }}
                                </UButton>
                            </div>
                        </form>
                    </UCard>
                </template>
            </UModal>
        </div>
    </OrganisationGate>
</template>

<script setup lang="ts">
import { BOUWSTEEN_INKOOPBELEID } from '#shared/werkinstructies/bouwsteen-0-2'

/**
 * Het startpunt van bouwsteen 0.2.
 *
 * Dit is het welkomscherm uit de designhandoff, niet een overzichtspagina met een link ernaar.
 * Wie in de zijbalk op Inkoopbeleid klikt, ziet meteen wat de bouwsteen inhoudt, de vijf
 * stappen, en een knop die de route start. Het beleidsoverzicht en de losse hulpmiddelen staan
 * eronder, want die zijn gereedschap naast de route, niet de route zelf.
 */

interface PolicyRow {
    id: string
    title: string
    status: string
    version: number
    periodStart: string | null
    periodEnd: string | null
    updatedAt: string
}

definePageMeta({ fullBleed: true })

const bouwsteen = BOUWSTEEN_INKOOPBELEID

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const { organisations, organisation, organisationId, identifyOrganisation } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.title') })

// --- Organisatie ----------------------------------------------------------------------------
// Dit scherm rendert alleen binnen `OrganisationGate`, dus er is hier altijd al minstens de
// eigen organisatie als optie.
const organisationItems = computed(() =>
    organisations.value.map((o) => ({ label: o.name, value: o.id })),
)

// UInputMenu modelleert "niets gekozen" als undefined, de store als null; hier vertaald.
const selectedOrganisation = computed<string | undefined>({
    get: () => organisationId.value ?? undefined,
    set: (v) => (organisationId.value = v ?? null),
})

const creatingOrganisation = ref(false)

async function onCreateOrganisation(name: string) {
    creatingOrganisation.value = true
    try {
        await identifyOrganisation(name)
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    } finally {
        creatingOrganisation.value = false
    }
}

// --- Beleidsdocumenten van deze organisatie -------------------------------------------------
const headers = useRequestHeaders(['cookie'])
const { data, refresh } = await useAsyncData<PolicyRow[]>(
    'inkoopbeleid-policies',
    () => {
        if (!organisationId.value) return Promise.resolve([])
        return $fetch('/api/inkoopbeleid/policies', {
            query: { organisationId: organisationId.value },
            headers,
        })
    },
    { watch: [organisationId], default: () => [] },
)
const policies = computed(() => data.value ?? [])

/** Het enige beleid, als er precies een is. Dan hoeft de gebruiker niets te kiezen. */
const enigBeleid = computed(() => (policies.value.length === 1 ? policies.value[0] : undefined))

/** "Stap 3 van 5" bij een status, voor de keuzelijst. */
function stapNummerVoor(status: string): number {
    const i = bouwsteen.stappen.findIndex((s) => s.status === status)
    return i === -1 ? 1 : i + 1
}

// --- De startknop ---------------------------------------------------------------------------
/**
 * Een knop, drie situaties.
 *
 * Geen beleid: de knop maakt er een aan en opent de route, zodat een nieuwe klant met een klik
 * in stap 0.2.1 staat. Een beleid: de knop opent de route van dat beleid. Meer dan een: de
 * knop opent de meest recent bewerkte, en de keuzelijst eronder biedt de andere.
 */
const startLabel = computed(() => {
    if (policies.value.length === 0) return t('werkroute.welkom.start')
    return t('werkroute.welkom.resume')
})

const starting = ref(false)

async function start() {
    if (!organisationId.value || starting.value) return
    if (policies.value.length > 0) {
        const recentste = [...policies.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!
        await router.push(`/dashboard/inkoopbeleid/${recentste.id}/route`)
        return
    }
    starting.value = true
    try {
        const created = await createPolicy(
            t('werkroute.welkom.defaultTitle', { organisatie: organisation.value?.name ?? '' }),
        )
        if (created) await router.push(`/dashboard/inkoopbeleid/${created.id}/route`)
    } finally {
        starting.value = false
    }
}

// --- Aanmaken -------------------------------------------------------------------------------
const showCreate = ref(false)
const creating = ref(false)
const draft = reactive({ title: '', periodStart: '', periodEnd: '' })

/**
 * Maakt een beleid aan. Zonder argument komt de titel uit het formulier; met argument is het
 * de startknop die een eerste beleid nodig heeft en geen formulier wil tonen.
 */
async function createPolicy(titel?: string): Promise<PolicyRow | null> {
    if (!organisationId.value) return null
    creating.value = true
    try {
        const created = await $fetch<PolicyRow>('/api/inkoopbeleid/policies', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                title: titel ?? draft.title,
                // Lege datumvelden zijn '', wat zod als datum afkeurt. Dan liever null.
                periodStart: titel ? null : draft.periodStart || null,
                periodEnd: titel ? null : draft.periodEnd || null,
            },
        })
        showCreate.value = false
        Object.assign(draft, { title: '', periodStart: '', periodEnd: '' })
        await refresh()
        toast.add({ title: t('inkoopbeleid.overview.created'), color: 'success' })
        return created
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
        return null
    } finally {
        creating.value = false
    }
}
</script>
