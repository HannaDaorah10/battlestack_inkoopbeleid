<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface PromptRow {
    id: string
    key: string
    name: string
    description: string
    content: string
    version: number
    updatedAt: string
}

interface PromptList {
    rows: PromptRow[]
    total: number
    limit: number
    offset: number
}

const { t } = useI18n()
// SSR cookie forward: `requireRole` 401s otherwise.
const headers = useRequestHeaders(['cookie'])
const toast = useToast()
const { data, pending, refresh } = await useAsyncData<PromptList>('prompts-admin-list', () =>
    $fetch('/api/prompts', { headers }),
)

const editing = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const saving = ref<string | null>(null)
// Destructief, dus achter een bevestigingsmodal in plaats van `confirm()`.
const resetTarget = ref<PromptRow | null>(null)
const resetting = ref(false)

function startEdit(p: PromptRow) {
    editing.value[p.id] = p.content
    errors.value[p.id] = ''
}

async function save(p: PromptRow) {
    const content = editing.value[p.id]
    if (typeof content !== 'string') return
    errors.value[p.id] = ''
    saving.value = p.id
    try {
        await $fetch(`/api/prompts/${p.id}`, {
            method: 'PUT',
            body: { content },
        })
        Reflect.deleteProperty(editing.value, p.id)
        await refresh()
        toast.add({ title: t('prompts.savedTitle', { name: p.name }), color: 'success' })
    } catch (e) {
        const msg
            = (e as { statusMessage?: string }).statusMessage
                || (e as Error).message
                || t('prompts.saveFailed')
        errors.value[p.id] = msg
        // Blijft staan tot hij wordt weggeklikt; de bewerkte tekst blijft staan.
        toast.add({
            title: t('prompts.saveFailedTitle'),
            description: msg,
            color: 'error',
            duration: 0,
        })
    } finally {
        saving.value = null
    }
}

async function confirmReset() {
    const p = resetTarget.value
    if (!p) return
    resetting.value = true
    try {
        await $fetch(`/api/prompts/${p.id}/reset`, { method: 'POST' })
        Reflect.deleteProperty(editing.value, p.id)
        await refresh()
        resetTarget.value = null
        toast.add({ title: t('prompts.resetTitle', { name: p.name }), color: 'success' })
    } catch (e) {
        const msg
            = (e as { statusMessage?: string }).statusMessage
                || (e as Error).message
                || t('prompts.resetFailed')
        errors.value[p.id] = msg
        resetTarget.value = null
        toast.add({
            title: t('prompts.resetFailedTitle'),
            description: msg,
            color: 'error',
            duration: 0,
        })
    } finally {
        resetting.value = false
    }
}
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="adj-page-title">
                {{ t('prompts.title') }}
            </h1>
            <p class="mt-1.5 adj-lead">
                {{ t('prompts.subtitle') }}
            </p>
        </div>

        <!-- Skeleton in de vorm van de kaarten die komen. -->
        <div
            v-if="pending && !data"
            class="space-y-4"
        >
            <USkeleton
                v-for="i in 3"
                :key="i"
                class="h-40 w-full"
            />
        </div>

        <AdjEmptyState
            v-else-if="(data?.rows.length ?? 0) === 0"
            icon="i-lucide-message-square-text"
            :title="t('prompts.empty.title')"
            :description="t('prompts.empty.description')"
        />

        <div
            v-else
            class="space-y-4"
        >
            <UCard
                v-for="p in data?.rows ?? []"
                :key="p.id"
            >
                <template #header>
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h2 class="adj-subhead">
                                {{ p.name }}
                            </h2>
                            <p class="font-mono text-xs text-dimmed">
                                {{ p.key }} · {{ t('prompts.version', { n: p.version }) }}
                            </p>
                            <p
                                v-if="p.description"
                                class="mt-1 text-sm text-muted"
                            >
                                {{ p.description }}
                            </p>
                        </div>
                        <div class="flex shrink-0 flex-wrap gap-3">
                            <UButton
                                v-if="!(p.id in editing)"
                                size="sm"
                                color="neutral"
                                variant="link"
                                icon="i-lucide-pencil"
                                @click="startEdit(p)"
                            >
                                {{ t('prompts.edit') }}
                            </UButton>
                            <UButton
                                size="sm"
                                color="neutral"
                                variant="link"
                                icon="i-lucide-rotate-ccw"
                                @click="resetTarget = p"
                            >
                                {{ t('prompts.reset') }}
                            </UButton>
                        </div>
                    </div>
                </template>

                <UTextarea
                    v-if="p.id in editing"
                    v-model="editing[p.id]"
                    :rows="8"
                    class="w-full font-mono"
                />
                <pre
                    v-else
                    class="max-h-64 overflow-auto rounded-md border border-muted bg-muted p-4 font-mono text-sm whitespace-pre-wrap text-toned"
                >{{ p.content }}</pre>

                <p
                    v-if="errors[p.id]"
                    class="mt-2 text-xs text-error"
                >
                    {{ errors[p.id] }}
                </p>

                <template
                    v-if="p.id in editing"
                    #footer
                >
                    <div class="flex justify-end gap-2.5">
                        <UButton
                            color="neutral"
                            variant="outline"
                            @click="delete editing[p.id]"
                        >
                            {{ t('prompts.cancel') }}
                        </UButton>
                        <UButton
                            :loading="saving === p.id"
                            :disabled="saving === p.id"
                            @click="save(p)"
                        >
                            {{ t('prompts.save') }}
                        </UButton>
                    </div>
                </template>
            </UCard>
        </div>

        <!-- Destructieve bevestiging: benoemt het object en het gevolg. -->
        <UModal
            :open="resetTarget !== null"
            :title="t('prompts.resetTitleModal')"
            @update:open="(v) => { if (!v) resetTarget = null }"
        >
            <template #body>
                <p class="text-base">
                    {{ t('prompts.resetConfirm', { key: resetTarget?.key ?? '' }) }}
                </p>
            </template>
            <template #footer>
                <div class="flex w-full justify-end gap-2.5">
                    <UButton
                        color="neutral"
                        variant="outline"
                        @click="resetTarget = null"
                    >
                        {{ t('prompts.cancel') }}
                    </UButton>
                    <UButton
                        color="error"
                        :loading="resetting"
                        :disabled="resetting"
                        @click="confirmReset"
                    >
                        {{ t('prompts.resetConfirmAction') }}
                    </UButton>
                </div>
            </template>
        </UModal>
    </div>
</template>
