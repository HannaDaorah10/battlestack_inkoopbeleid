<!--
  Organisatiekeuze: een filter dat bepaalt welk beleid, welke documenten en
  welke drempels je ziet. De navigatie tussen de inkoopbeleid-pagina's zat hier
  eerst als rij tabknoppen; die is verhuisd naar de subnavigatie in de sidebar,
  want tabs schakelen weergaven bínnen een pagina — nooit tussen pagina's.

  Typen zoekt in de bestaande organisaties of biedt aan om een nieuwe aan te maken, in plaats
  van een gesloten lijst om uit te kiezen. Dit component verschijnt alleen binnen
  `OrganisationGate`, dus er is hier altijd al minstens de eigen organisatie als optie.
-->
<template>
    <UCard>
        <UFormField
            :label="t('inkoopbeleid.organisation.label')"
            :description="t('inkoopbeleid.organisation.hint')"
            class="sm:max-w-sm"
        >
            <UInputMenu
                v-model="selected"
                :items="items"
                :create-item="true"
                value-key="value"
                :placeholder="t('inkoopbeleid.organisation.switcherPlaceholder')"
                :loading="creating"
                class="w-full"
                @create="onCreate"
            />
        </UFormField>
    </UCard>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { organisations, organisationId, identifyOrganisation } = await useOrganisations()

const items = computed(() =>
    organisations.value.map((o) => ({ label: o.name, value: o.id })),
)

// Written through the composable's computed setter, which persists it to the store.
// `undefined` rather than `null` on the wire: UInputMenu models "nothing selected" as
// undefined, while the store uses null, so the two are translated here rather than leaking
// either way.
const selected = computed<string | undefined>({
    get: () => organisationId.value ?? undefined,
    set: (v) => (organisationId.value = v ?? null),
})

const creating = ref(false)

async function onCreate(name: string) {
    creating.value = true
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
        creating.value = false
    }
}
</script>
