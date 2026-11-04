<template>
    <OrganisationGate>
        <div class="space-y-6">
            <div>
                <h1 class="adj-page-title">
                    {{ t('inkoopbeleid.rules.title') }}
                </h1>
                <p class="mt-1.5 adj-lead">
                    {{ t('inkoopbeleid.rules.subtitle') }}
                </p>
            </div>

            <OrganisationSwitcher />

            <!-- Drempelbedragen: hoe je inkoopt -->
            <UCard>
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.check.rulesHeading') }}
                    </h2>
                    <p class="mt-1 text-sm text-muted">
                        {{ t('inkoopbeleid.rules.thresholdsHint') }}
                    </p>
                </template>

                <ul
                    v-if="rules.thresholds.length"
                    class="mb-5 space-y-2"
                >
                    <li
                        v-for="row in rules.thresholds"
                        :key="row.id"
                        class="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-default p-3 text-sm"
                    >
                        <div class="min-w-0">
                            <p class="font-medium">
                                {{ t(`inkoopbeleid.purchaseType.${row.purchaseType}`) }}
                                &middot;
                                {{ formatRange(row.minAmountCents, row.maxAmountCents, locale, t('inkoopbeleid.check.noUpperBound')) }}
                            </p>
                            <p class="text-muted">
                                {{ t(`inkoopbeleid.procedure.${row.procedure}`) }}
                                &middot; {{ t('inkoopbeleid.rules.quotes', { n: row.minQuotes }) }}
                                &middot; {{ t(`inkoopbeleid.requirement.${row.extraRequirement}`) }}
                                <template v-if="row.advisorRequired">
                                    &middot; {{ t('inkoopbeleid.rules.advisorRequired') }}
                                </template>
                                &middot; {{ t(`inkoopbeleid.ruleSet.${row.ruleSet}`) }}
                            </p>
                        </div>
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="link"
                            size="xs"
                            :loading="removingId === row.id"
                            @click="remove('thresholds', row.id)"
                        >
                            {{ t('inkoopbeleid.rules.remove') }}
                        </UButton>
                    </li>
                </ul>
                <AdjEmptyState
                    v-else
                    class="mb-5"
                    icon="i-lucide-scale"
                    :title="t('inkoopbeleid.rules.noThresholds')"
                />

                <form
                    class="space-y-3"
                    @submit.prevent="addThreshold"
                >
                    <h3 class="adj-subhead">
                        {{ t('inkoopbeleid.rules.addThreshold') }}
                    </h3>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <UFormField :label="t('inkoopbeleid.check.purchaseType')">
                            <USelect
                                v-model="threshold.purchaseType"
                                :content="SELECT_CONTENT"
                                :items="purchaseTypeItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField
                            :label="t('inkoopbeleid.rules.from')"
                            required
                        >
                            <UInput
                                v-model.number="threshold.fromEuros"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                class="w-full"
                            >
                                <template #leading>
                                    <span class="text-muted">&euro;</span>
                                </template>
                            </UInput>
                        </UFormField>
                        <UFormField
                            :label="t('inkoopbeleid.rules.to')"
                            :description="t('inkoopbeleid.rules.toHint')"
                        >
                            <UInput
                                v-model.number="threshold.toEuros"
                                type="number"
                                min="0"
                                step="0.01"
                                class="w-full"
                            >
                                <template #leading>
                                    <span class="text-muted">&euro;</span>
                                </template>
                            </UInput>
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.procedure')">
                            <USelect
                                v-model="threshold.procedure"
                                :content="SELECT_CONTENT"
                                :items="procedureItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.minQuotes')">
                            <UInput
                                v-model.number="threshold.minQuotes"
                                type="number"
                                min="1"
                                max="50"
                                step="1"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.extraRequirement')">
                            <USelect
                                v-model="threshold.extraRequirement"
                                :content="SELECT_CONTENT"
                                :items="requirementItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.ruleSet')">
                            <USelect
                                v-model="threshold.ruleSet"
                                :content="SELECT_CONTENT"
                                :items="ruleSetItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField
                            :label="t('inkoopbeleid.check.columns.advisor')"
                            class="flex flex-col justify-end"
                        >
                            <UCheckbox
                                v-model="threshold.advisorRequired"
                                :label="t('inkoopbeleid.rules.advisorRequired')"
                            />
                        </UFormField>
                    </div>
                    <UButton
                        type="submit"
                        icon="i-lucide-plus"
                        :loading="savingThreshold"
                        :disabled="!canAddThreshold"
                    >
                        {{ t('inkoopbeleid.rules.addThreshold') }}
                    </UButton>
                </form>
            </UCard>

            <!-- Mandaten: wie mag tekenen -->
            <UCard>
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.check.mandatesHeading') }}
                    </h2>
                    <p class="mt-1 text-sm text-muted">
                        {{ t('inkoopbeleid.rules.mandatesHint') }}
                    </p>
                </template>

                <ul
                    v-if="rules.mandates.length"
                    class="mb-5 space-y-2"
                >
                    <li
                        v-for="row in rules.mandates"
                        :key="row.id"
                        class="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-default p-3 text-sm"
                    >
                        <div class="min-w-0">
                            <p class="font-medium">
                                {{ row.roleName }}
                                <span
                                    v-if="row.department"
                                    class="font-normal text-muted"
                                >({{ row.department }})</span>
                            </p>
                            <p class="text-muted">
                                {{ t('inkoopbeleid.rules.ceiling', { amount: formatCents(row.ceilingAmountCents, locale) }) }}
                                <template v-if="row.scope">
                                    &middot; {{ row.scope }}
                                </template>
                            </p>
                        </div>
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="link"
                            size="xs"
                            :loading="removingId === row.id"
                            @click="remove('mandates', row.id)"
                        >
                            {{ t('inkoopbeleid.rules.remove') }}
                        </UButton>
                    </li>
                </ul>
                <AdjEmptyState
                    v-else
                    class="mb-5"
                    icon="i-lucide-pen-line"
                    :title="t('inkoopbeleid.rules.noMandates')"
                />

                <form
                    class="space-y-3"
                    @submit.prevent="addMandate"
                >
                    <h3 class="adj-subhead">
                        {{ t('inkoopbeleid.rules.addMandate') }}
                    </h3>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <UFormField
                            :label="t('inkoopbeleid.check.columns.role')"
                            required
                        >
                            <UInput
                                v-model="mandate.roleName"
                                :placeholder="t('inkoopbeleid.rules.rolePlaceholder')"
                                required
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.columns.department')">
                            <UInput
                                v-model="mandate.department"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField
                            :label="t('inkoopbeleid.check.columns.ceiling')"
                            required
                        >
                            <UInput
                                v-model.number="mandate.ceilingEuros"
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                class="w-full"
                            >
                                <template #leading>
                                    <span class="text-muted">&euro;</span>
                                </template>
                            </UInput>
                        </UFormField>
                        <UFormField :label="t('inkoopbeleid.check.columns.scope')">
                            <UInput
                                v-model="mandate.scope"
                                :placeholder="t('inkoopbeleid.rules.scopePlaceholder')"
                                class="w-full"
                            />
                        </UFormField>
                    </div>
                    <UButton
                        type="submit"
                        icon="i-lucide-plus"
                        :loading="savingMandate"
                        :disabled="!canAddMandate"
                    >
                        {{ t('inkoopbeleid.rules.addMandate') }}
                    </UButton>
                </form>
            </UCard>
        </div>
    </OrganisationGate>
</template>

<script setup lang="ts">
/**
 * Drempelbedragen en mandaten per organisatie.
 *
 * Deze gegevens bestonden alleen in de seed, waardoor een nieuwe organisatie nooit "Drempelbedragen
 * vastgelegd" of "Mandaten vastgelegd" kon halen en Toets een inkoop voor haar geen uitkomst gaf.
 * Bewust een lijst met toevoegen en verwijderen en geen rijen bewerken: een tier is een paar
 * getallen, en verwijderen en opnieuw toevoegen is net zo snel en laat geen halve wijziging achter.
 */
interface ThresholdRow {
    id: string
    ruleSet: string
    purchaseType: string
    minAmountCents: number
    maxAmountCents: number | null
    procedure: string
    minQuotes: number
    extraRequirement: string
    advisorRequired: boolean
}

interface MandateRow {
    id: string
    roleName: string
    department: string
    ceilingAmountCents: number
    scope: string
}

const { t, locale } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.rules.title') })

const headers = useRequestHeaders(['cookie'])
const { data, refresh } = await useAsyncData<{ thresholds: ThresholdRow[], mandates: MandateRow[] }>(
    'inkoopbeleid-rules-beheer',
    () => {
        if (!organisationId.value) return Promise.resolve({ thresholds: [], mandates: [] })
        return $fetch('/api/inkoopbeleid/rules', {
            query: { organisationId: organisationId.value },
            headers,
        })
    },
    { watch: [organisationId], default: () => ({ thresholds: [], mandates: [] }) },
)
const rules = computed(() => data.value ?? { thresholds: [], mandates: [] })

const PURCHASE_TYPES = ['werken', 'diensten_leveringen', 'any'] as const
const PROCEDURES = ['enkelvoudig_onderhands', 'meervoudig_onderhands', 'aanbesteding', 'offerteprocedure', 'een_op_een'] as const
const REQUIREMENTS = ['vastleggen_offerteaanvraag', 'gunningsadvies', 'strategie_en_gunningsadvies', 'categoriemanagement'] as const
const RULE_SETS = ['current', 'legacy'] as const

const purchaseTypeItems = computed(() =>
    PURCHASE_TYPES.map((v) => ({ label: t(`inkoopbeleid.purchaseType.${v}`), value: v })),
)
const procedureItems = computed(() =>
    PROCEDURES.map((v) => ({ label: t(`inkoopbeleid.procedure.${v}`), value: v })),
)
const requirementItems = computed(() =>
    REQUIREMENTS.map((v) => ({ label: t(`inkoopbeleid.requirement.${v}`), value: v })),
)
const ruleSetItems = computed(() =>
    RULE_SETS.map((v) => ({ label: t(`inkoopbeleid.ruleSet.${v}`), value: v })),
)

function notifyError(e: unknown) {
    toast.add({
        title: t('inkoopbeleid.error'),
        description: serverErrorMessage(e, t('inkoopbeleid.error')),
        color: 'error',
        duration: 0,
    })
}

// --- Drempels -----------------------------------------------------------------------------
const threshold = reactive({
    purchaseType: 'diensten_leveringen' as typeof PURCHASE_TYPES[number],
    fromEuros: null as number | null,
    toEuros: null as number | null,
    procedure: 'enkelvoudig_onderhands' as typeof PROCEDURES[number],
    minQuotes: 1,
    extraRequirement: 'vastleggen_offerteaanvraag' as typeof REQUIREMENTS[number],
    ruleSet: 'current' as typeof RULE_SETS[number],
    advisorRequired: false,
})
const savingThreshold = ref(false)

// `null`/leeg "tot" betekent geen bovengrens; anders moet het boven "vanaf" liggen, zoals de
// CHECK in de database ook eist.
const canAddThreshold = computed(() =>
    !!organisationId.value
    && typeof threshold.fromEuros === 'number'
    && threshold.fromEuros >= 0
    && (typeof threshold.toEuros !== 'number' || threshold.toEuros > threshold.fromEuros)
    && threshold.minQuotes >= 1,
)

async function addThreshold() {
    if (!canAddThreshold.value || !organisationId.value) return
    savingThreshold.value = true
    try {
        await $fetch('/api/inkoopbeleid/thresholds', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                ruleSet: threshold.ruleSet,
                purchaseType: threshold.purchaseType,
                minAmountCents: eurosToCents(threshold.fromEuros),
                maxAmountCents: typeof threshold.toEuros === 'number' ? eurosToCents(threshold.toEuros) : null,
                procedure: threshold.procedure,
                minQuotes: threshold.minQuotes,
                extraRequirement: threshold.extraRequirement,
                advisorRequired: threshold.advisorRequired,
            },
        })
        // De volgende tier begint meestal waar deze ophield.
        threshold.fromEuros = typeof threshold.toEuros === 'number' ? threshold.toEuros : null
        threshold.toEuros = null
        await refresh()
        toast.add({ title: t('inkoopbeleid.rules.added'), color: 'success' })
    } catch (e) {
        notifyError(e)
    } finally {
        savingThreshold.value = false
    }
}

// --- Mandaten -----------------------------------------------------------------------------
const mandate = reactive({
    roleName: '',
    department: '',
    ceilingEuros: null as number | null,
    scope: '',
})
const savingMandate = ref(false)

const canAddMandate = computed(() =>
    !!organisationId.value
    && mandate.roleName.trim().length > 0
    && typeof mandate.ceilingEuros === 'number'
    && mandate.ceilingEuros >= 0,
)

async function addMandate() {
    if (!canAddMandate.value || !organisationId.value) return
    savingMandate.value = true
    try {
        await $fetch('/api/inkoopbeleid/mandates', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                roleName: mandate.roleName.trim(),
                department: mandate.department.trim(),
                ceilingAmountCents: eurosToCents(mandate.ceilingEuros),
                scope: mandate.scope.trim(),
            },
        })
        Object.assign(mandate, { roleName: '', department: '', ceilingEuros: null, scope: '' })
        await refresh()
        toast.add({ title: t('inkoopbeleid.rules.added'), color: 'success' })
    } catch (e) {
        notifyError(e)
    } finally {
        savingMandate.value = false
    }
}

// --- Verwijderen --------------------------------------------------------------------------
const removingId = ref<string | null>(null)

async function remove(kind: 'thresholds' | 'mandates', id: string) {
    removingId.value = id
    try {
        await $fetch(`/api/inkoopbeleid/${kind}/${id}`, { method: 'DELETE' })
        await refresh()
        toast.add({ title: t('inkoopbeleid.rules.removed'), color: 'success' })
    } catch (e) {
        notifyError(e)
    } finally {
        removingId.value = null
    }
}
</script>
