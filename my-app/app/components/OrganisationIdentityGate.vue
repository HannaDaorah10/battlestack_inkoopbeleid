<!--
  Eerste-bezoek-scherm: hier vertelt iemand de app voor welke organisatie ze werken, in plaats
  van een organisatie te kiezen uit een lijst. Bestaat de getypte naam al, dan gaat de bezoeker
  verder bij die organisatie; bestaat hij nog niet, dan wordt hij aangemaakt. Verschijnt overal
  waar `OrganisationGate` nog geen organisatie heeft.
-->
<template>
    <div class="flex min-h-full flex-1 items-center justify-center px-6 py-16">
        <UCard class="w-full max-w-md">
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.organisation.gate.title') }}
                </h2>
                <p class="mt-1 text-sm text-muted">
                    {{ t('inkoopbeleid.organisation.gate.body') }}
                </p>
            </template>

            <form
                class="space-y-3"
                @submit.prevent="onSubmit"
            >
                <UFormField :label="t('inkoopbeleid.organisation.gate.label')">
                    <UInput
                        v-model="name"
                        :placeholder="t('inkoopbeleid.organisation.gate.placeholder')"
                        autofocus
                        class="w-full"
                    />
                </UFormField>

                <p
                    v-if="hint"
                    class="text-xs text-muted"
                >
                    {{ hint }}
                </p>

                <UButton
                    type="submit"
                    block
                    :loading="submitting"
                    :disabled="!name.trim()"
                >
                    {{ t('inkoopbeleid.organisation.gate.submit') }}
                </UButton>
            </form>
        </UCard>
    </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { organisations, identifyOrganisation } = await useOrganisations()

const name = ref('')
const submitting = ref(false)

const hint = computed(() => {
    const trimmed = name.value.trim()
    if (!trimmed) return ''
    const match = organisations.value.find(
        (o) => o.name.toLowerCase() === trimmed.toLowerCase(),
    )
    return match
        ? t('inkoopbeleid.organisation.gate.matchHint', { name: match.name })
        : t('inkoopbeleid.organisation.gate.createHint', { name: trimmed })
})

async function onSubmit() {
    const trimmed = name.value.trim()
    if (!trimmed || submitting.value) return
    submitting.value = true
    try {
        await identifyOrganisation(trimmed)
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    } finally {
        submitting.value = false
    }
}
</script>
