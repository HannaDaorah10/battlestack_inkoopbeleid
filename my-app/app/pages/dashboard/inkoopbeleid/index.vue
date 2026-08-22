<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight">
                {{ t('inkoopbeleid.title') }}
            </h1>
            <p class="mt-1 text-muted">
                {{ t('inkoopbeleid.subtitle') }}
            </p>
        </div>

        <OrganisationSwitcher />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NuxtLink
                v-for="link in quickLinks"
                :key="link.to"
                :to="link.to"
                class="group"
            >
                <UCard class="h-full transition hover:ring-primary hover:shadow-sm">
                    <div class="flex items-start gap-3">
                        <UIcon
                            :name="link.icon"
                            class="mt-0.5 shrink-0 text-2xl text-primary"
                        />
                        <div class="min-w-0">
                            <p class="font-semibold group-hover:text-primary">
                                {{ link.label }}
                            </p>
                            <p class="text-sm text-muted">
                                {{ link.hint }}
                            </p>
                        </div>
                    </div>
                </UCard>
            </NuxtLink>
        </div>

        <UCard>
            <template #header>
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-semibold">
                        {{ t('inkoopbeleid.overview.heading') }}
                    </h2>
                    <UButton
                        icon="i-lucide-plus"
                        :disabled="!organisationId"
                        @click="showCreate = true"
                    >
                        {{ t('inkoopbeleid.overview.new') }}
                    </UButton>
                </div>
            </template>

            <p
                v-if="!organisationId"
                class="text-sm text-muted"
            >
                {{ t('inkoopbeleid.organisation.none') }}
            </p>
            <template v-else>
                <UTable
                    :data="policies"
                    :columns="columns"
                    :loading="status === 'pending'"
                >
                    <template #title-cell="{ row }">
                        <NuxtLink
                            :to="`/dashboard/inkoopbeleid/${row.original.id}`"
                            class="text-primary-600 hover:underline"
                        >
                            {{ row.original.title }}
                        </NuxtLink>
                    </template>
                    <template #status-cell="{ row }">
                        <UBadge :color="statusColor(row.original.status)">
                            {{ t(`inkoopbeleid.status.${row.original.status}`) }}
                        </UBadge>
                    </template>
                    <template #period-cell="{ row }">
                        {{ formatPeriod(row.original.periodStart, row.original.periodEnd) }}
                    </template>
                    <template #updatedAt-cell="{ row }">
                        {{ new Date(row.original.updatedAt).toLocaleDateString(locale) }}
                    </template>
                </UTable>

                <p
                    v-if="status !== 'pending' && policies.length === 0"
                    class="mt-3 text-sm text-muted"
                >
                    {{ t('inkoopbeleid.overview.empty') }}
                </p>
            </template>
        </UCard>

        <UModal v-model:open="showCreate">
            <template #content>
                <UCard>
                    <template #header>
                        {{ t('inkoopbeleid.overview.createTitle') }}
                    </template>
                    <form
                        class="space-y-3"
                        @submit.prevent="createPolicy"
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
                                variant="ghost"
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
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface PolicyRow {
    id: string
    title: string
    status: string
    version: number
    periodStart: string | null
    periodEnd: string | null
    updatedAt: string
}

const { t, locale } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.title') })

// SSR cookie forward: `requireUserSession` 401s during server render otherwise.
const headers = useRequestHeaders(['cookie'])
const { data, status, refresh } = await useAsyncData<PolicyRow[]>(
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

const columns = computed<TableColumn<PolicyRow>[]>(() => [
    { accessorKey: 'title', header: t('inkoopbeleid.overview.columns.title') },
    { accessorKey: 'status', header: t('inkoopbeleid.overview.columns.status') },
    { accessorKey: 'version', header: t('inkoopbeleid.overview.columns.version') },
    { accessorKey: 'period', header: t('inkoopbeleid.overview.columns.period') },
    { accessorKey: 'updatedAt', header: t('inkoopbeleid.overview.columns.updatedAt') },
])

const quickLinks = computed(() => [
    {
        to: '/dashboard/inkoopbeleid/documenten',
        icon: 'i-lucide-file-text',
        label: t('inkoopbeleid.overview.quickLinks.documents'),
        hint: t('inkoopbeleid.overview.quickLinks.documentsHint'),
    },
    {
        to: '/dashboard/inkoopbeleid/adviseur',
        icon: 'i-lucide-message-circle-question',
        label: t('inkoopbeleid.overview.quickLinks.advisor'),
        hint: t('inkoopbeleid.overview.quickLinks.advisorHint'),
    },
    {
        to: '/dashboard/inkoopbeleid/toets',
        icon: 'i-lucide-calculator',
        label: t('inkoopbeleid.overview.quickLinks.check'),
        hint: t('inkoopbeleid.overview.quickLinks.checkHint'),
    },
    {
        to: '/dashboard/inkoopbeleid/afwijkingen',
        icon: 'i-lucide-triangle-alert',
        label: t('inkoopbeleid.overview.quickLinks.deviations'),
        hint: t('inkoopbeleid.overview.quickLinks.deviationsHint'),
    },
])

function statusColor(status: string) {
    if (status === 'vastgesteld') return 'success' as const
    if (status === 'bespreken') return 'warning' as const
    return 'neutral' as const
}

function formatPeriod(start: string | null, end: string | null): string {
    if (!start && !end) return '-'
    const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale.value) : '…')
    return `${fmt(start)} - ${fmt(end)}`
}

const showCreate = ref(false)
const creating = ref(false)
const draft = reactive({ title: '', periodStart: '', periodEnd: '' })

async function createPolicy() {
    if (!organisationId.value) return
    creating.value = true
    try {
        await $fetch('/api/inkoopbeleid/policies', {
            method: 'POST',
            body: {
                organisationId: organisationId.value,
                title: draft.title,
                // Empty date inputs are '', which zod rejects as a date. Send null instead.
                periodStart: draft.periodStart || null,
                periodEnd: draft.periodEnd || null,
            },
        })
        showCreate.value = false
        Object.assign(draft, { title: '', periodStart: '', periodEnd: '' })
        await refresh()
        toast.add({ title: t('inkoopbeleid.overview.created'), color: 'success' })
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
        })
    } finally {
        creating.value = false
    }
}
</script>
