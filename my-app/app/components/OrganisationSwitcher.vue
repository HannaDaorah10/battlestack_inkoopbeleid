<template>
    <UCard>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <UFormField
                :label="t('inkoopbeleid.organisation.label')"
                :description="t('inkoopbeleid.organisation.hint')"
                class="sm:max-w-sm sm:flex-1"
            >
                <USelect
                    v-model="selected"
                    :items="items"
                    :disabled="items.length === 0"
                    value-key="value"
                    class="w-full"
                />
            </UFormField>

            <p
                v-if="items.length === 0"
                class="text-sm text-muted"
            >
                {{ t('inkoopbeleid.organisation.empty') }}
            </p>
            <nav
                v-else
                class="flex flex-wrap gap-1"
                :aria-label="t('inkoopbeleid.title')"
            >
                <UButton
                    v-for="link in links"
                    :key="link.to"
                    :to="link.to"
                    :icon="link.icon"
                    size="sm"
                    :variant="isActive(link.to) ? 'soft' : 'ghost'"
                    :color="isActive(link.to) ? 'primary' : 'neutral'"
                >
                    {{ link.label }}
                </UButton>
            </nav>
        </div>
    </UCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { organisations, organisationId } = await useOrganisations()

const items = computed(() =>
    organisations.value.map((o) => ({ label: o.name, value: o.id })),
)

// Written through the composable's computed setter, which persists it to the store.
// `undefined` rather than `null` on the wire: USelect models "nothing selected" as undefined,
// while the store uses null, so the two are translated here rather than leaking either way.
const selected = computed<string | undefined>({
    get: () => organisationId.value ?? undefined,
    set: (v) => (organisationId.value = v ?? null),
})

const links = computed(() => [
    { to: '/dashboard/inkoopbeleid', icon: 'i-lucide-list', label: t('inkoopbeleid.nav.overview') },
    { to: '/dashboard/inkoopbeleid/documenten', icon: 'i-lucide-file-text', label: t('inkoopbeleid.nav.documents') },
    { to: '/dashboard/inkoopbeleid/adviseur', icon: 'i-lucide-message-circle-question', label: t('inkoopbeleid.nav.advisor') },
    { to: '/dashboard/inkoopbeleid/toets', icon: 'i-lucide-calculator', label: t('inkoopbeleid.nav.check') },
    { to: '/dashboard/inkoopbeleid/afwijkingen', icon: 'i-lucide-triangle-alert', label: t('inkoopbeleid.nav.deviations') },
])

// Exact match only: the overview lives at the prefix of every other link, so a `startsWith`
// test would light up the overview button on every page.
function isActive(to: string): boolean {
    return route.path === to
}
</script>
