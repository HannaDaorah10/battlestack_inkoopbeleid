<template>
    <div class="space-y-6">
        <div>
            <h1 class="adj-page-title">
                {{ t('inkoopbeleid.deviations.title') }}
            </h1>
            <p class="mt-1.5 adj-lead">
                {{ t('inkoopbeleid.deviations.subtitle') }}
            </p>
        </div>

        <OrganisationSwitcher />

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.deviations.heading') }}
                </h2>
            </template>

            <form
                class="space-y-3"
                @submit.prevent="onSubmit"
            >
                <UFormField
                    :label="t('inkoopbeleid.deviations.subject')"
                    required
                >
                    <UInput
                        v-model="form.subject"
                        :placeholder="t('inkoopbeleid.deviations.subjectPlaceholder')"
                        required
                        class="w-full"
                    />
                </UFormField>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <UFormField :label="t('inkoopbeleid.deviations.amount')">
                        <UInput
                            v-model.number="form.euros"
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
                    <UFormField :label="t('inkoopbeleid.deviations.purchaseType')">
                        <USelect
                            v-model="form.purchaseType"
                            :items="purchaseTypeItems"
                            value-key="value"
                            class="w-full"
                        />
                    </UFormField>
                </div>

                <UFormField
                    :label="t('inkoopbeleid.deviations.ruleSkipped')"
                    required
                >
                    <UInput
                        v-model="form.ruleSkipped"
                        :placeholder="t('inkoopbeleid.deviations.ruleSkippedPlaceholder')"
                        required
                        class="w-full"
                    />
                </UFormField>

                <UFormField
                    :label="t('inkoopbeleid.deviations.justification')"
                    :description="t('inkoopbeleid.deviations.justificationHint')"
                    required
                >
                    <UTextarea
                        v-model="form.justification"
                        :rows="4"
                        required
                        class="w-full"
                    />
                </UFormField>

                <UFormField :label="t('inkoopbeleid.deviations.approverRole')">
                    <UInput
                        v-model="form.approverRole"
                        :placeholder="t('inkoopbeleid.deviations.approverRolePlaceholder')"
                        class="w-full"
                    />
                </UFormField>

                <UButton
                    type="submit"
                    :loading="saving"
                    :disabled="!canSubmit"
                >
                    {{ t('inkoopbeleid.deviations.submit') }}
                </UButton>
            </form>
        </UCard>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.deviations.listHeading') }}
                </h2>
            </template>

            <div
                v-if="deviations.length"
                class="space-y-3"
            >
                <div
                    v-for="d in deviations"
                    :key="d.id"
                    class="rounded-sm border border-default p-3"
                >
                    <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <p class="font-medium">
                            {{ d.subject }}
                        </p>
                        <span class="text-xs text-muted">
                            {{ new Date(d.createdAt).toLocaleDateString(locale) }}
                            <template v-if="d.recordedByName || d.recordedByEmail">
                                &middot;
                                {{ t('inkoopbeleid.deviations.recordedBy', { name: d.recordedByName || d.recordedByEmail }) }}
                            </template>
                        </span>
                    </div>
                    <p class="mt-1 text-sm">
                        <span class="text-muted">{{ t('inkoopbeleid.deviations.columns.ruleSkipped') }}:</span>
                        {{ d.ruleSkipped }}
                        <template v-if="d.amountCents !== null">
                            &middot; {{ formatCents(d.amountCents, locale) }}
                        </template>
                    </p>
                    <p class="mt-2 whitespace-pre-wrap text-sm">
                        {{ d.justification }}
                    </p>
                    <p
                        v-if="d.approverRole"
                        class="mt-2 text-xs text-muted"
                    >
                        {{ t('inkoopbeleid.deviations.columns.approverRole') }}: {{ d.approverRole }}
                    </p>
                </div>
            </div>
            <div
                v-else-if="status === 'pending'"
                class="space-y-2"
            >
                <USkeleton
                    v-for="i in 2"
                    :key="i"
                    class="h-24 w-full"
                />
            </div>
            <AdjEmptyState
                v-else
                icon="i-lucide-triangle-alert"
                :title="t('inkoopbeleid.deviations.empty')"
            />
        </UCard>
    </div>
</template>

<script setup lang="ts">
interface DeviationRow {
    id: string
    subject: string
    amountCents: number | null
    purchaseType: string | null
    ruleSkipped: string
    justification: string
    approverRole: string
    createdAt: string
    recordedByName: string | null
    recordedByEmail: string | null
}

const { t, locale } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.deviations.title') })

const headers = useRequestHeaders(['cookie'])
const { data, status, refresh } = await useAsyncData<DeviationRow[]>(
    'inkoopbeleid-deviations',
    () => {
        if (!organisationId.value) return Promise.resolve([])
        return $fetch('/api/inkoopbeleid/deviations', {
            query: { organisationId: organisationId.value },
            headers,
        })
    },
    { watch: [organisationId], default: () => [] },
)
const deviations = computed(() => data.value ?? [])

const PURCHASE_TYPES = ['werken', 'diensten_leveringen'] as const
type PurchaseTypeValue = typeof PURCHASE_TYPES[number]

const purchaseTypeItems = computed(() =>
    PURCHASE_TYPES.map((v) => ({
        label: t(`inkoopbeleid.purchaseType.${v}`),
        value: v,
    })),
)

const form = reactive({
    subject: '',
    euros: null as number | null,
    purchaseType: 'diensten_leveringen' as PurchaseTypeValue,
    ruleSkipped: '',
    justification: '',
    approverRole: '',
})
const saving = ref(false)

// Mirrors the server's 20-character floor, so the button is disabled rather than the request
// bouncing. The server keeps enforcing it: this is convenience, not the guarantee.
const canSubmit = computed(
    () =>
        !!organisationId.value
        && form.subject.trim().length > 0
        && form.ruleSkipped.trim().length > 0
        && form.justification.trim().length >= 20,
)

async function onSubmit() {
    if (!canSubmit.value || !organisationId.value) return
    saving.value = true
    try {
        await $fetch('/api/inkoopbeleid/deviations', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                subject: form.subject.trim(),
                amountCents: form.euros === null ? null : eurosToCents(form.euros),
                purchaseType: form.purchaseType,
                ruleSkipped: form.ruleSkipped.trim(),
                justification: form.justification.trim(),
                approverRole: form.approverRole.trim(),
            },
        })
        Object.assign(form, {
            subject: '',
            euros: null,
            ruleSkipped: '',
            justification: '',
            approverRole: '',
        })
        await refresh()
        toast.add({ title: t('inkoopbeleid.deviations.submitted'), color: 'success' })
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    } finally {
        saving.value = false
    }
}
</script>
