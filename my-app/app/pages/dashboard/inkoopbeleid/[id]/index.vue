<template>
    <div
        v-if="detail"
        class="space-y-6"
    >
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
                <UButton
                    to="/dashboard/inkoopbeleid"
                    variant="link"
                    color="neutral"
                    icon="i-lucide-arrow-left"
                    class="-ml-2 mb-1"
                >
                    {{ t('inkoopbeleid.back') }}
                </UButton>
                <h1 class="adj-page-title">
                    {{ detail.policy.title }}
                </h1>
                <p class="mt-1 text-sm text-muted">
                    {{ t('inkoopbeleid.overview.columns.version') }} {{ detail.policy.version }}
                    <template v-if="detail.policy.periodStart || detail.policy.periodEnd">
                        &middot; {{ formatPeriod(detail.policy.periodStart, detail.policy.periodEnd) }}
                    </template>
                </p>
            </div>
            <UBadge
                size="lg"
                :color="statusColor(detail.policy.status)"
            >
                {{ t(`inkoopbeleid.status.${detail.policy.status}`) }}
            </UBadge>
        </div>

        <!-- De begeleide route staat bovenaan: dit is de manier waarop de werkinstructie
             bedoeld is om doorlopen te worden. De kaarten eronder blijven het losse gereedschap
             voor wie gericht een hoofdstuk of een doel wil aanpassen. -->
        <NuxtLink
            :to="`/dashboard/inkoopbeleid/${policyId}/route`"
            class="block no-underline"
        >
            <UCard class="transition-colors hover:bg-accented">
                <div class="flex items-center gap-3">
                    <UIcon
                        name="i-lucide-route"
                        class="size-5 shrink-0 text-toned"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-highlighted">
                            {{ t('werkroute.open') }}
                        </p>
                        <p class="text-sm text-muted">
                            {{ t('werkroute.openHint') }}
                        </p>
                    </div>
                    <UIcon
                        name="i-lucide-arrow-right"
                        class="size-4 shrink-0 text-muted"
                    />
                </div>
            </UCard>
        </NuxtLink>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UCard>
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.status.label') }}
                    </h2>
                </template>
                <p class="text-sm text-muted">
                    {{ t(`inkoopbeleid.status.descriptions.${detail.policy.status}`) }}
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                    <UButton
                        v-for="next in detail.allowedTransitions"
                        :key="next"
                        :loading="movingTo === next"
                        :disabled="movingTo !== null"
                        color="neutral"
                        variant="outline"
                        @click="moveTo(next)"
                    >
                        {{ t('inkoopbeleid.status.moveTo', { status: t(`inkoopbeleid.status.${next}`) }) }}
                    </UButton>
                    <p
                        v-if="detail.allowedTransitions.length === 0"
                        class="text-sm text-muted"
                    >
                        {{ t('inkoopbeleid.status.noMoves') }}
                    </p>
                </div>
            </UCard>

            <UCard>
                <template #header>
                    <div class="flex items-center justify-between">
                        <h2 class="adj-card-title">
                            {{ t('inkoopbeleid.completeness.heading') }}
                        </h2>
                        <UBadge color="neutral">
                            {{ t('inkoopbeleid.completeness.score') }}
                            {{ Math.round(detail.completeness.score * 100) }}%
                        </UBadge>
                    </div>
                </template>
                <ul class="space-y-1.5 text-sm">
                    <li class="flex items-center gap-2">
                        <UIcon
                            :name="tickIcon(detail.completeness.chaptersFilled === detail.completeness.chapterTotal)"
                            :class="tickClass(detail.completeness.chaptersFilled === detail.completeness.chapterTotal)"
                        />
                        {{ t('inkoopbeleid.completeness.chapters', {
                            filled: detail.completeness.chaptersFilled,
                            total: detail.completeness.chapterTotal,
                        }) }}
                    </li>
                    <li
                        v-for="flag in completenessFlags"
                        :key="flag.key"
                        class="flex items-center gap-2"
                    >
                        <UIcon
                            :name="tickIcon(flag.ok)"
                            :class="tickClass(flag.ok)"
                        />
                        {{ flag.label }}
                    </li>
                </ul>
            </UCard>
        </div>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.goals.heading') }}
                </h2>
            </template>

            <ul
                v-if="detail.goals.length"
                class="mb-4 space-y-2"
            >
                <li
                    v-for="goal in detail.goals"
                    :key="goal.id"
                    class="flex items-start justify-between gap-3 rounded-sm border border-default p-3"
                >
                    <div class="min-w-0">
                        <p class="font-medium">
                            {{ goal.name }}
                        </p>
                        <p
                            v-if="goal.description"
                            class="text-sm text-muted"
                        >
                            {{ goal.description }}
                        </p>
                    </div>
                    <UButton
                        icon="i-lucide-trash-2"
                        color="neutral"
                        variant="link"
                        size="xs"
                        @click="removeGoal(goal.id)"
                    >
                        {{ t('inkoopbeleid.delete') }}
                    </UButton>
                </li>
            </ul>
            <AdjEmptyState
                v-else
                class="mb-4"
                icon="i-lucide-target"
                :title="t('inkoopbeleid.goals.empty')"
            />

            <form
                class="flex flex-col gap-2 sm:flex-row sm:items-end"
                @submit.prevent="addGoal"
            >
                <UFormField
                    :label="t('inkoopbeleid.goals.name')"
                    class="sm:w-56"
                >
                    <UInput
                        v-model="newGoal.name"
                        class="w-full"
                    />
                </UFormField>
                <UFormField
                    :label="t('inkoopbeleid.goals.description')"
                    class="flex-1"
                >
                    <UInput
                        v-model="newGoal.description"
                        class="w-full"
                    />
                </UFormField>
                <UButton
                    type="submit"
                    :disabled="!newGoal.name.trim()"
                    icon="i-lucide-plus"
                >
                    {{ t('inkoopbeleid.goals.add') }}
                </UButton>
            </form>
        </UCard>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.chapters.heading') }}
                </h2>
            </template>

            <div class="space-y-3">
                <div
                    v-for="chapter in detail.chapters"
                    :key="chapter.id"
                    class="rounded-sm border border-default p-3"
                >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <h3 class="adj-subhead">
                            {{ chapter.number }}. {{ chapter.title }}
                        </h3>
                        <div class="flex flex-wrap gap-1">
                            <UButton
                                size="xs"
                                variant="link"
                                color="neutral"
                                icon="i-lucide-pencil"
                                @click="toggleEdit(chapter)"
                            >
                                {{ t('inkoopbeleid.chapters.edit') }}
                            </UButton>
                            <UButton
                                size="xs"
                                color="neutral"
                                variant="outline"
                                icon="i-lucide-sparkles"
                                :loading="draftingId === chapter.id"
                                :disabled="draftingId !== null"
                                @click="draftChapter(chapter)"
                            >
                                {{ draftingId === chapter.id ? t('inkoopbeleid.chapters.drafting') : t('inkoopbeleid.chapters.draft') }}
                            </UButton>
                        </div>
                    </div>

                    <template v-if="editingId === chapter.id">
                        <UEditor
                            v-model="editingContent"
                            content-type="markdown"
                            class="mt-3 rounded-md border border-default"
                        >
                            <template #default="{ editor }">
                                <UEditorToolbar
                                    :editor="editor"
                                    class="border-b border-default"
                                />
                            </template>
                        </UEditor>
                        <div class="mt-2 flex gap-2">
                            <UButton
                                size="sm"
                                :loading="savingChapter"
                                @click="saveChapter(chapter)"
                            >
                                {{ t('inkoopbeleid.save') }}
                            </UButton>
                            <UButton
                                size="sm"
                                color="neutral"
                                variant="outline"
                                @click="editingId = null"
                            >
                                {{ t('inkoopbeleid.cancel') }}
                            </UButton>
                        </div>
                    </template>
                    <p
                        v-else-if="chapter.contentMarkdown.trim()"
                        class="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted"
                    >
                        {{ chapter.contentMarkdown }}
                    </p>
                    <p
                        v-else
                        class="mt-2 text-sm text-muted italic"
                    >
                        {{ t('inkoopbeleid.chapters.empty') }}
                    </p>
                </div>
            </div>
        </UCard>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('inkoopbeleid.reviews.heading') }}
                </h2>
            </template>

            <form
                class="mb-4 space-y-3"
                @submit.prevent="submitReview"
            >
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <UFormField :label="t('inkoopbeleid.reviews.chapter')">
                        <USelect
                            v-model="review.chapterId"
                            :items="chapterItems"
                            value-key="value"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField :label="t('inkoopbeleid.reviews.decision.label')">
                        <USelect
                            v-model="review.decision"
                            :items="decisionItems"
                            value-key="value"
                            class="w-full"
                        />
                    </UFormField>
                </div>
                <UFormField :label="t('inkoopbeleid.reviews.comment')">
                    <UTextarea
                        v-model="review.comment"
                        :rows="3"
                        :placeholder="t('inkoopbeleid.reviews.commentPlaceholder')"
                        class="w-full"
                    />
                </UFormField>
                <UButton
                    type="submit"
                    :loading="postingReview"
                    :disabled="!canReview"
                >
                    {{ t('inkoopbeleid.reviews.submit') }}
                </UButton>
            </form>

            <ul
                v-if="reviews.length"
                class="space-y-2"
            >
                <li
                    v-for="r in reviews"
                    :key="r.id"
                    class="rounded-sm border border-default p-3"
                >
                    <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <UBadge :color="decisionColor(r.decision)">
                            {{ t(`inkoopbeleid.reviews.decision.${r.decision}`) }}
                        </UBadge>
                        <span class="text-xs text-muted">
                            {{ r.chapterNumber ? `${t('inkoopbeleid.reviews.chapter')} ${r.chapterNumber}` : t('inkoopbeleid.reviews.wholePolicy') }}
                            &middot;
                            {{ t('inkoopbeleid.reviews.by', { name: r.authorName || r.authorEmail || t('inkoopbeleid.reviews.anonymous') }) }}
                            &middot;
                            {{ new Date(r.createdAt).toLocaleDateString(locale) }}
                        </span>
                    </div>
                    <p
                        v-if="r.comment"
                        class="mt-2 whitespace-pre-wrap text-sm"
                    >
                        {{ r.comment }}
                    </p>
                </li>
            </ul>
            <AdjEmptyState
                v-else
                icon="i-lucide-message-square-quote"
                :title="t('inkoopbeleid.reviews.empty')"
            />
        </UCard>

        <UModal v-model:open="showDraft">
            <template #content>
                <UCard>
                    <template #header>
                        {{ t('inkoopbeleid.chapters.draftReady') }}
                    </template>
                    <UAlert
                        v-if="draftResult && !draftResult.grounded"
                        icon="i-lucide-triangle-alert"
                        color="warning"
                        variant="subtle"
                        :description="t('inkoopbeleid.advisor.ungrounded')"
                        class="mb-3"
                    />
                    <pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-elevated p-3 text-sm">{{ draftResult?.draft }}</pre>
                    <template #footer>
                        <div class="flex justify-end gap-2">
                            <UButton
                                color="neutral"
                                variant="outline"
                                @click="showDraft = false"
                            >
                                {{ t('inkoopbeleid.chapters.discardDraft') }}
                            </UButton>
                            <UButton @click="acceptDraft">
                                {{ t('inkoopbeleid.chapters.useDraft') }}
                            </UButton>
                        </div>
                    </template>
                </UCard>
            </template>
        </UModal>
    </div>

    <div
        v-else-if="status === 'pending'"
        class="space-y-6"
    >
        <USkeleton class="h-12 w-2/3" />
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <USkeleton class="h-44 w-full" />
            <USkeleton class="h-44 w-full" />
        </div>
        <USkeleton class="h-56 w-full" />
    </div>
</template>

<script setup lang="ts">
interface Chapter {
    id: string
    number: number
    key: string
    title: string
    contentMarkdown: string
}

interface Goal {
    id: string
    name: string
    description: string
}

interface PolicyDetail {
    policy: {
        id: string
        title: string
        status: string
        version: number
        periodStart: string | null
        periodEnd: string | null
    }
    chapters: Chapter[]
    goals: Goal[]
    completeness: {
        chaptersFilled: number
        chapterTotal: number
        hasGoals: boolean
        hasThresholds: boolean
        hasMandates: boolean
        withinValidityPeriod: boolean | null
        score: number
    }
    allowedTransitions: string[]
}

interface Review {
    id: string
    chapterId: string | null
    chapterNumber: number | null
    comment: string
    decision: string
    createdAt: string
    authorName: string | null
    authorEmail: string | null
}

interface DraftResult {
    draft: string
    grounded: boolean
}

const { t, locale } = useI18n()
const toast = useToast()
const route = useRoute()
const policyId = computed(() => String(route.params.id))

const headers = useRequestHeaders(['cookie'])
const { data: detail, status, refresh } = await useAsyncData<PolicyDetail>(
    () => `inkoopbeleid-policy-${policyId.value}`,
    () => $fetch(`/api/inkoopbeleid/policies/${policyId.value}`, { headers }),
    { watch: [policyId] },
)

const { data: reviewData, refresh: refreshReviews } = await useAsyncData<Review[]>(
    () => `inkoopbeleid-reviews-${policyId.value}`,
    () => $fetch(`/api/inkoopbeleid/policies/${policyId.value}/reviews`, { headers }),
    { watch: [policyId], default: () => [] },
)
const reviews = computed(() => reviewData.value ?? [])

useHead({ title: () => detail.value?.policy.title ?? t('inkoopbeleid.title') })

function statusColor(s: string) {
    if (s === 'vastgesteld') return 'success' as const
    if (s === 'bespreken') return 'warning' as const
    return 'neutral' as const
}
function decisionColor(d: string) {
    if (d === 'approve') return 'success' as const
    if (d === 'reject') return 'error' as const
    return 'neutral' as const
}
function tickIcon(ok: boolean): string {
    return ok ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'
}
function tickClass(ok: boolean): string {
    return ok ? 'text-success' : 'text-muted'
}
function formatPeriod(start: string | null, end: string | null): string {
    const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale.value) : '…')
    return `${fmt(start)} - ${fmt(end)}`
}

const completenessFlags = computed(() => {
    const c = detail.value?.completeness
    if (!c) return []
    return [
        { key: 'goals', ok: c.hasGoals, label: t('inkoopbeleid.completeness.goals') },
        { key: 'thresholds', ok: c.hasThresholds, label: t('inkoopbeleid.completeness.thresholds') },
        { key: 'mandates', ok: c.hasMandates, label: t('inkoopbeleid.completeness.mandates') },
        {
            key: 'validity',
            ok: c.withinValidityPeriod === true,
            // `null` means no period was recorded at all, which is a different and more
            // actionable statement than "the period has expired".
            label: c.withinValidityPeriod === null
                ? t('inkoopbeleid.completeness.validityUnknown')
                : t('inkoopbeleid.completeness.validity'),
        },
    ]
})

function notifyError(e: unknown) {
    toast.add({
        title: t('inkoopbeleid.error'),
        description: serverErrorMessage(e, t('inkoopbeleid.error')),
        color: 'error',
        duration: 0,
    })
}

// --- Status ---------------------------------------------------------------------------
const movingTo = ref<string | null>(null)

async function moveTo(next: string) {
    movingTo.value = next
    try {
        await $fetch(`/api/inkoopbeleid/policies/${policyId.value}/status`, {
            method: 'PUT',
            body: { status: next },
        })
        await refresh()
        toast.add({
            title: t('inkoopbeleid.status.changed', { status: t(`inkoopbeleid.status.${next}`) }),
            color: 'success',
        })
    } catch (e) {
        notifyError(e)
    } finally {
        movingTo.value = null
    }
}

// --- Goals ----------------------------------------------------------------------------
const newGoal = reactive({ name: '', description: '' })

async function addGoal() {
    if (!newGoal.name.trim()) return
    try {
        await $fetch(`/api/inkoopbeleid/policies/${policyId.value}/goals`, {
            method: 'POST',
            body: { name: newGoal.name.trim(), description: newGoal.description.trim() },
        })
        newGoal.name = ''
        newGoal.description = ''
        await refresh()
        toast.add({ title: t('inkoopbeleid.goals.added'), color: 'success' })
    } catch (e) {
        notifyError(e)
    }
}

async function removeGoal(id: string) {
    try {
        await $fetch(`/api/inkoopbeleid/goals/${id}`, { method: 'DELETE' })
        await refresh()
        toast.add({ title: t('inkoopbeleid.goals.removed'), color: 'success' })
    } catch (e) {
        notifyError(e)
    }
}

// --- Chapters -------------------------------------------------------------------------
const editingId = ref<string | null>(null)
const editingContent = ref('')
const savingChapter = ref(false)

function toggleEdit(chapter: Chapter) {
    if (editingId.value === chapter.id) {
        editingId.value = null
        return
    }
    editingId.value = chapter.id
    editingContent.value = chapter.contentMarkdown
}

async function saveChapter(chapter: Chapter) {
    savingChapter.value = true
    try {
        await $fetch(`/api/inkoopbeleid/chapters/${chapter.id}`, {
            method: 'PUT',
            body: { contentMarkdown: editingContent.value },
        })
        editingId.value = null
        await refresh()
        toast.add({ title: t('inkoopbeleid.chapters.saved'), color: 'success' })
    } catch (e) {
        notifyError(e)
    } finally {
        savingChapter.value = false
    }
}

const draftingId = ref<string | null>(null)
const draftResult = ref<DraftResult | null>(null)
const draftChapterId = ref<string | null>(null)
const showDraft = ref(false)

async function draftChapter(chapter: Chapter) {
    draftingId.value = chapter.id
    try {
        // `save: false`: the draft is shown first. Overwriting a chapter someone has already
        // written, without them seeing what replaced it, is not a feature.
        draftResult.value = await $fetch<DraftResult>(
            `/api/inkoopbeleid/chapters/${chapter.id}/draft`,
            { method: 'POST', body: { save: false } },
        )
        draftChapterId.value = chapter.id
        showDraft.value = true
    } catch (e) {
        notifyError(e)
    } finally {
        draftingId.value = null
    }
}

function acceptDraft() {
    if (!draftResult.value || !draftChapterId.value) return
    editingId.value = draftChapterId.value
    editingContent.value = draftResult.value.draft
    showDraft.value = false
}

// --- Reviews --------------------------------------------------------------------------
type ReviewDecisionValue = 'comment' | 'approve' | 'reject'

const review = reactive({
    chapterId: null as string | null,
    decision: 'comment' as ReviewDecisionValue,
    comment: '',
})
const postingReview = ref(false)

const chapterItems = computed(() => [
    { label: t('inkoopbeleid.reviews.wholePolicy'), value: null },
    ...(detail.value?.chapters ?? []).map((c) => ({
        label: `${c.number}. ${c.title}`,
        value: c.id,
    })),
])

const DECISIONS = ['comment', 'approve', 'reject'] as const satisfies readonly ReviewDecisionValue[]

const decisionItems = computed(() =>
    DECISIONS.map((v) => ({
        label: t(`inkoopbeleid.reviews.decision.${v}`),
        value: v,
    })),
)

// Mirrors the server rule: a plain comment needs text, a decision does not.
const canReview = computed(
    () => review.decision !== 'comment' || review.comment.trim().length > 0,
)

async function submitReview() {
    if (!canReview.value) return
    postingReview.value = true
    try {
        await $fetch(`/api/inkoopbeleid/policies/${policyId.value}/reviews`, {
            method: 'POST',
            body: {
                chapterId: review.chapterId,
                decision: review.decision,
                comment: review.comment.trim(),
            },
        })
        review.comment = ''
        review.decision = 'comment'
        await refreshReviews()
        toast.add({ title: t('inkoopbeleid.reviews.submitted'), color: 'success' })
    } catch (e) {
        notifyError(e)
    } finally {
        postingReview.value = false
    }
}
</script>
