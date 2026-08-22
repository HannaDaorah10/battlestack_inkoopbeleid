<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight">
                {{ t('inkoopbeleid.advisor.title') }}
            </h1>
            <p class="mt-1 text-muted">
                {{ t('inkoopbeleid.advisor.subtitle') }}
            </p>
        </div>

        <OrganisationSwitcher />

        <UCard>
            <div class="space-y-3">
                <UFormField :label="t('inkoopbeleid.advisor.question')">
                    <UTextarea
                        v-model="question"
                        :rows="3"
                        :placeholder="t('inkoopbeleid.advisor.questionPlaceholder')"
                        class="w-full"
                        @keydown.enter.meta="onAsk"
                        @keydown.enter.ctrl="onAsk"
                    />
                </UFormField>

                <div class="flex flex-wrap items-center gap-2">
                    <UButton
                        :loading="asking"
                        :disabled="!canAsk"
                        icon="i-lucide-sparkles"
                        @click="onAsk"
                    >
                        {{ asking ? t('inkoopbeleid.advisor.asking') : t('inkoopbeleid.advisor.ask') }}
                    </UButton>
                </div>

                <div class="pt-1">
                    <p class="mb-1 text-xs font-medium text-muted">
                        {{ t('inkoopbeleid.advisor.examples') }}
                    </p>
                    <div class="flex flex-wrap gap-1">
                        <UButton
                            v-for="(example, i) in examples"
                            :key="i"
                            size="xs"
                            variant="soft"
                            color="neutral"
                            @click="question = example"
                        >
                            {{ example }}
                        </UButton>
                    </div>
                </div>
            </div>
        </UCard>

        <UCard v-if="answer !== null">
            <template #header>
                <h2 class="font-semibold">
                    {{ t('inkoopbeleid.advisor.answer') }}
                </h2>
            </template>

            <UAlert
                v-if="!grounded"
                icon="i-lucide-triangle-alert"
                color="warning"
                variant="subtle"
                :description="t('inkoopbeleid.advisor.ungrounded')"
                class="mb-3"
            />

            <p class="whitespace-pre-wrap text-sm leading-relaxed">
                {{ answer }}
            </p>

            <template #footer>
                <div v-if="sources.length">
                    <p class="mb-2 text-xs font-medium text-muted">
                        {{ t('inkoopbeleid.advisor.sources') }}
                    </p>
                    <ul class="space-y-1">
                        <li
                            v-for="(s, i) in sources"
                            :key="i"
                            class="flex items-center justify-between gap-2 text-sm"
                        >
                            <span class="truncate">{{ s.source || s.title }}</span>
                            <span class="shrink-0 font-mono text-xs text-muted">
                                {{ t('inkoopbeleid.advisor.score') }} {{ s.score.toFixed(3) }}
                            </span>
                        </li>
                    </ul>
                </div>
                <p
                    v-else
                    class="text-sm text-muted"
                >
                    {{ t('inkoopbeleid.advisor.noSources') }}
                </p>
            </template>
        </UCard>
    </div>
</template>

<script setup lang="ts">
interface AdviceSource {
    title: string
    source: string
    score: number
}

interface AdviceResponse {
    answer: string
    sources: AdviceSource[]
    grounded: boolean
}

const { t } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.advisor.title') })

const question = ref('')
const asking = ref(false)
const answer = ref<string | null>(null)
const sources = ref<AdviceSource[]>([])
const grounded = ref(true)

const canAsk = computed(() => !!organisationId.value && question.value.trim().length >= 3)

const examples = computed(() => [
    t('inkoopbeleid.advisor.example1'),
    t('inkoopbeleid.advisor.example2'),
    t('inkoopbeleid.advisor.example3'),
])

async function onAsk() {
    if (!canAsk.value || !organisationId.value || asking.value) return
    asking.value = true
    try {
        const res = await $fetch<AdviceResponse>('/api/inkoopbeleid/advies', {
            method: 'POST',
            body: { organisationId: organisationId.value, question: question.value.trim() },
        })
        answer.value = res.answer
        sources.value = res.sources
        grounded.value = res.grounded
    } catch (e) {
        // Cleared, not left stale: a visible previous answer next to a failed request reads as
        // if the new question was answered.
        answer.value = null
        sources.value = []
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
        })
    } finally {
        asking.value = false
    }
}
</script>
