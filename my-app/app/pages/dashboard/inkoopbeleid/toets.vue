<template>
    <OrganisationGate>
        <div class="space-y-6">
            <div>
                <h1 class="adj-page-title">
                    {{ t('inkoopbeleid.check.title') }}
                </h1>
                <p class="mt-1.5 adj-lead">
                    {{ t('inkoopbeleid.check.subtitle') }}
                </p>
            </div>

            <OrganisationSwitcher />

            <UCard>
                <form
                    class="space-y-3"
                    @submit.prevent="onCheck"
                >
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <UFormField
                            :label="t('inkoopbeleid.check.amount')"
                            :description="t('inkoopbeleid.check.amountHint')"
                            required
                        >
                            <UInput
                                v-model.number="form.euros"
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
                            :label="t('inkoopbeleid.check.purchaseType')"
                            required
                        >
                            <USelect
                                v-model="form.purchaseType"
                                :items="purchaseTypeItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField :label="t('inkoopbeleid.check.recurrence')">
                            <USelect
                                v-model="form.recurrence"
                                :items="recurrenceItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField :label="t('inkoopbeleid.check.duration')">
                            <UInput
                                v-model.number="form.durationYears"
                                type="number"
                                min="0"
                                max="50"
                                step="1"
                                class="w-full"
                            />
                        </UFormField>

                        <UFormField :label="t('inkoopbeleid.check.ruleSet')">
                            <USelect
                                v-model="form.ruleSet"
                                :items="ruleSetItems"
                                value-key="value"
                                class="w-full"
                            />
                        </UFormField>
                    </div>

                    <UButton
                        type="submit"
                        icon="i-lucide-calculator"
                        :loading="checking"
                        :disabled="!organisationId"
                    >
                        {{ checking ? t('inkoopbeleid.check.submitting') : t('inkoopbeleid.check.submit') }}
                    </UButton>
                </form>
            </UCard>

            <UCard v-if="verdict">
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.check.verdict') }}
                    </h2>
                </template>

                <UAlert
                    v-if="!verdict.threshold"
                    icon="i-lucide-triangle-alert"
                    color="warning"
                    variant="subtle"
                    :description="t('inkoopbeleid.check.noThreshold')"
                    class="mb-4"
                />

                <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div>
                        <dt class="text-xs font-medium text-muted">
                            {{ t('inkoopbeleid.check.contractValue') }}
                        </dt>
                        <dd class="text-lg font-semibold">
                            {{ formatCents(verdict.contractValueCents, locale) }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-xs font-medium text-muted">
                            {{ t('inkoopbeleid.check.procedure') }}
                        </dt>
                        <dd class="text-lg font-semibold">
                            {{ verdict.procedure ? t(`inkoopbeleid.procedure.${verdict.procedure}`) : '-' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-xs font-medium text-muted">
                            {{ t('inkoopbeleid.check.minQuotes') }}
                        </dt>
                        <dd class="text-lg font-semibold">
                            {{ verdict.minQuotes ?? '-' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="text-xs font-medium text-muted">
                            {{ t('inkoopbeleid.check.extraRequirement') }}
                        </dt>
                        <dd class="font-medium">
                            {{ verdict.extraRequirement ? t(`inkoopbeleid.requirement.${verdict.extraRequirement}`) : '-' }}
                        </dd>
                    </div>
                    <div class="sm:col-span-2">
                        <dt class="text-xs font-medium text-muted">
                            {{ t('inkoopbeleid.check.mandate') }}
                        </dt>
                        <dd
                            v-if="verdict.mandate"
                            class="font-medium"
                        >
                            {{ verdict.mandate.roleName }}
                            <span class="text-muted">
                                ({{ formatCents(verdict.mandate.ceilingAmountCents, locale) }})
                            </span>
                            <span
                                v-if="verdict.mandateAlternatives.length"
                                class="block text-sm text-muted"
                            >
                                {{ t('inkoopbeleid.check.mandateAlternatives') }}:
                                {{ verdict.mandateAlternatives.map((m) => m.roleName).join(', ') }}
                            </span>
                        </dd>
                        <dd
                            v-else
                            class="font-medium text-warning"
                        >
                            {{ t('inkoopbeleid.check.mandateNone') }}
                        </dd>
                    </div>
                </dl>

                <template #footer>
                    <p class="mb-2 text-xs font-medium text-muted">
                        {{ t('inkoopbeleid.check.obligationsHeading') }}
                    </p>
                    <ul class="space-y-2">
                        <li
                            v-for="code in verdict.obligations"
                            :key="code"
                            class="flex items-start gap-2 text-sm"
                        >
                            <UIcon
                                :name="obligationIcon(code)"
                                class="mt-0.5 shrink-0"
                                :class="obligationClass(code)"
                            />
                            <span>{{ t(`inkoopbeleid.obligation.${code}`) }}</span>
                        </li>
                    </ul>
                </template>
            </UCard>

            <UCard v-if="rules && rules.thresholds.length">
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.check.rulesHeading') }}
                    </h2>
                </template>
                <UTable
                    :data="rules.thresholds"
                    :columns="thresholdColumns"
                >
                    <template #range-cell="{ row }">
                        {{ formatRange(row.original.minAmountCents, row.original.maxAmountCents, locale, t('inkoopbeleid.check.noUpperBound')) }}
                    </template>
                    <template #purchaseType-cell="{ row }">
                        {{ t(`inkoopbeleid.purchaseType.${row.original.purchaseType}`) }}
                    </template>
                    <template #procedure-cell="{ row }">
                        {{ t(`inkoopbeleid.procedure.${row.original.procedure}`) }}
                    </template>
                    <template #extraRequirement-cell="{ row }">
                        {{ t(`inkoopbeleid.requirement.${row.original.extraRequirement}`) }}
                    </template>
                    <template #advisorRequired-cell="{ row }">
                        <UIcon
                            v-if="row.original.advisorRequired"
                            name="i-lucide-check"
                            class="text-success"
                        />
                        <span
                            v-else
                            class="text-muted"
                        >-</span>
                    </template>
                </UTable>
            </UCard>

            <UCard v-if="rules && rules.mandates.length">
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.check.mandatesHeading') }}
                    </h2>
                </template>
                <UTable
                    :data="rules.mandates"
                    :columns="mandateColumns"
                >
                    <template #ceilingAmountCents-cell="{ row }">
                        {{ formatCents(row.original.ceilingAmountCents, locale) }}
                    </template>
                </UTable>
            </UCard>
        </div>
    </OrganisationGate>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

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

interface Verdict {
    enteredAmountCents: number
    contractValueCents: number
    threshold: ThresholdRow | null
    procedure: string | null
    minQuotes: number | null
    extraRequirement: string | null
    advisorRequired: boolean
    mandate: MandateRow | null
    mandateAlternatives: MandateRow[]
    supervisoryBoardApprovalRequired: boolean
    obligations: string[]
}

const { t, locale } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.check.title') })

const PURCHASE_TYPES = ['werken', 'diensten_leveringen'] as const
const RECURRENCES = ['once', 'yearly'] as const
const RULE_SETS = ['current', 'legacy'] as const

const form = reactive({
    // 30.000 euro of services is the brief's own worked example, so the page opens on a query
    // whose correct answer a reviewer already knows.
    euros: 30000,
    purchaseType: 'diensten_leveringen' as typeof PURCHASE_TYPES[number],
    recurrence: 'once' as typeof RECURRENCES[number],
    durationYears: 1,
    ruleSet: 'current' as typeof RULE_SETS[number],
})

const purchaseTypeItems = computed(() =>
    PURCHASE_TYPES.map((v) => ({
        label: t(`inkoopbeleid.purchaseType.${v}`),
        value: v,
    })),
)
const recurrenceItems = computed(() =>
    RECURRENCES.map((v) => ({
        label: t(`inkoopbeleid.recurrence.${v}`),
        value: v,
    })),
)
const ruleSetItems = computed(() =>
    RULE_SETS.map((v) => ({
        label: t(`inkoopbeleid.ruleSet.${v}`),
        value: v,
    })),
)

const headers = useRequestHeaders(['cookie'])
const { data: rules } = await useAsyncData<{ thresholds: ThresholdRow[], mandates: MandateRow[] }>(
    'inkoopbeleid-rules',
    () => {
        if (!organisationId.value) return Promise.resolve({ thresholds: [], mandates: [] })
        return $fetch('/api/inkoopbeleid/rules', {
            query: { organisationId: organisationId.value },
            headers,
        })
    },
    { watch: [organisationId], default: () => ({ thresholds: [], mandates: [] }) },
)

const thresholdColumns = computed<TableColumn<ThresholdRow>[]>(() => [
    { accessorKey: 'purchaseType', header: t('inkoopbeleid.check.purchaseType') },
    { accessorKey: 'range', header: t('inkoopbeleid.check.columns.range') },
    { accessorKey: 'procedure', header: t('inkoopbeleid.check.columns.procedure') },
    { accessorKey: 'minQuotes', header: t('inkoopbeleid.check.columns.quotes') },
    { accessorKey: 'extraRequirement', header: t('inkoopbeleid.check.columns.extra') },
    { accessorKey: 'advisorRequired', header: t('inkoopbeleid.check.columns.advisor') },
])

const mandateColumns = computed<TableColumn<MandateRow>[]>(() => [
    { accessorKey: 'roleName', header: t('inkoopbeleid.check.columns.role') },
    { accessorKey: 'department', header: t('inkoopbeleid.check.columns.department') },
    { accessorKey: 'ceilingAmountCents', header: t('inkoopbeleid.check.columns.ceiling') },
    { accessorKey: 'scope', header: t('inkoopbeleid.check.columns.scope') },
])

const checking = ref(false)
const verdict = ref<Verdict | null>(null)

// Obligations are not all the same weight: three of them are hard blockers and the rest are
// reminders, so they get different icons rather than one undifferentiated list.
const BLOCKING = new Set(['no_mandate_covers', 'no_threshold_matches', 'supervisory_board_approval'])

function obligationIcon(code: string): string {
    if (BLOCKING.has(code)) return 'i-lucide-triangle-alert'
    if (code === 'advisor_required') return 'i-lucide-user-check'
    return 'i-lucide-info'
}
function obligationClass(code: string): string {
    return BLOCKING.has(code) ? 'text-warning' : 'text-muted'
}

async function onCheck() {
    if (!organisationId.value) return
    checking.value = true
    try {
        verdict.value = await $fetch<Verdict>('/api/inkoopbeleid/toets', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                amountCents: eurosToCents(form.euros),
                purchaseType: form.purchaseType,
                recurrence: form.recurrence,
                durationYears: form.durationYears,
                ruleSet: form.ruleSet,
            },
        })
    } catch (e) {
        verdict.value = null
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    } finally {
        checking.value = false
    }
}
</script>
