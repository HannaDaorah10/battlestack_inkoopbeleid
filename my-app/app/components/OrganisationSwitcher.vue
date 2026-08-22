<!--
  Organisatiekeuze: een filter dat bepaalt welk beleid, welke documenten en
  welke drempels je ziet. De navigatie tussen de inkoopbeleid-pagina's zat hier
  eerst als rij tabknoppen; die is verhuisd naar de subnavigatie in de sidebar,
  want tabs schakelen weergaven bínnen een pagina — nooit tussen pagina's.
-->
<template>
    <UCard>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
        </div>
    </UCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
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
</script>
