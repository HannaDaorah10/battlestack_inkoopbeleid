<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface ModelConfig {
    id: string
    key: string
    name: string
    description: string
    model: string
}

const { t } = useI18n()
const toast = useToast()

// SSR cookie forward: `requireRole` 401s otherwise.
const headers = useRequestHeaders(['cookie'])
const { data: modelConfigs, refresh: refreshConfigs } = await useAsyncData<ModelConfig[]>(
    'ai-model-configs',
    () => $fetch('/api/ai/configs', { headers }),
)
interface ProxyModel {
    id: string
    mode: 'chat' | 'embedding' | 'unknown'
    supportsFunctionCalling?: boolean
    supportsVision?: boolean
    supportsReasoning?: boolean
}

const { data: modelsData, pending: modelsPending } = useFetch('/api/ai/models', {
    lazy: true,
    default: () => ({ models: [] as ProxyModel[] }),
    headers,
})

const availableModels = computed<ProxyModel[]>(() => modelsData.value?.models ?? [])

// Filter the picker per row: embedding config gets `mode: 'embedding'` only, chat config gets `mode: 'chat'` only; `unknown` models are excluded from both.
function optionsFor(configKey: string) {
    const wantMode = configKey === 'embedding' ? 'embedding' : 'chat'
    return availableModels.value
        .filter((m) => m.mode === wantMode)
        .map((m) => ({ label: m.id, value: m.id }))
}

async function updateModelConfig(id: string, model: string) {
    try {
        await $fetch(`/api/ai/configs/${id}`, {
            method: 'PUT',
            body: { model },
        })
        toast.add({ title: t('mastraAdmin.updated'), color: 'success' })
        await refreshConfigs()
    } catch (error: unknown) {
        const message
            = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
                ?? t('mastraAdmin.errorGeneric')
        toast.add({ title: t('mastraAdmin.errorTitle'), description: message, color: 'error', duration: 0 })
    }
}

// --- Agents: each agent is attached to one model config + (optionally) one prompt ---
interface AgentRow {
    id: string
    key: string
    name: string
    description: string
    modelConfigKey: string
    promptKey: string | null
    enabled: boolean
}
interface PromptRow {
    id: string
    key: string
    name: string
}

const { data: agentRows, refresh: refreshAgents } = await useAsyncData<AgentRow[]>(
    'ai-agents',
    () => $fetch('/api/ai/agents', { headers }),
    { default: () => [] },
)

// Prompts live behind the optional `nuxt:prompts` feature; tolerate a 404 so the agent rows still render (prompt selector just shows "None").
const { data: promptsData } = await useAsyncData(
    'ai-prompts',
    () =>
        $fetch<{ rows: PromptRow[] }>('/api/prompts', { headers, query: { limit: 200 } }).catch(
            () => ({ rows: [] as PromptRow[] }),
        ),
    { default: () => ({ rows: [] as PromptRow[] }) },
)

const modelConfigOptions = computed(() =>
    (modelConfigs.value ?? []).map((c) => ({ label: c.name, value: c.key })),
)
const promptOptions = computed(() => [
    { label: t('mastraAdmin.noPrompt'), value: null as string | null },
    ...(promptsData.value?.rows ?? []).map((p) => ({ label: p.name || p.key, value: p.key })),
])

async function updateAgent(id: string, patch: Partial<Pick<AgentRow, 'modelConfigKey' | 'promptKey'>>) {
    try {
        await $fetch(`/api/ai/agents/${id}`, { method: 'PUT', body: patch })
        toast.add({ title: t('mastraAdmin.updated'), color: 'success' })
        await refreshAgents()
    } catch (error: unknown) {
        const message
            = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
                ?? t('mastraAdmin.errorGeneric')
        toast.add({ title: t('mastraAdmin.errorTitle'), description: message, color: 'error', duration: 0 })
    }
}
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="adj-page-title">
                {{ t('mastraAdmin.title') }}
            </h1>
            <p class="mt-1.5 adj-lead">
                {{ t('mastraAdmin.subtitle') }}
            </p>
        </div>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('mastraAdmin.configsHeader') }}
                </h2>
            </template>

            <div
                v-if="modelsPending && !availableModels.length"
                class="space-y-3"
            >
                <USkeleton
                    v-for="i in 3"
                    :key="i"
                    class="h-11 w-full"
                />
            </div>

            <AdjEmptyState
                v-else-if="!availableModels.length"
                icon="i-lucide-bot"
                :title="t('mastraAdmin.noModels')"
            />

            <div
                v-else
                class="space-y-4"
            >
                <div
                    v-for="config in modelConfigs ?? []"
                    :key="config.id"
                    class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                >
                    <div class="sm:w-48 shrink-0">
                        <p class="font-medium">
                            {{ config.name }}
                        </p>
                        <p
                            v-if="config.description"
                            class="text-xs text-muted"
                        >
                            {{ config.description }}
                        </p>
                    </div>
                    <USelectMenu
                        :model-value="config.model"
                        :items="optionsFor(config.key)"
                        value-key="value"
                        :placeholder="t('mastraAdmin.selectModel')"
                        :loading="modelsPending"
                        :search-input="{
                            placeholder: t('mastraAdmin.searchModels'),
                            icon: 'i-lucide-search',
                        }"
                        size="lg"
                        class="w-full sm:flex-1"
                        @update:model-value="updateModelConfig(config.id, $event as string)"
                    />
                </div>
            </div>
        </UCard>

        <UCard>
            <template #header>
                <h2 class="adj-card-title">
                    {{ t('mastraAdmin.agentsHeader') }}
                </h2>
                <p class="mt-1 text-sm text-muted">
                    {{ t('mastraAdmin.agentsSubtitle') }}
                </p>
            </template>

            <AdjEmptyState
                v-if="!(agentRows ?? []).length"
                icon="i-lucide-bot"
                :title="t('mastraAdmin.noAgents')"
            />

            <div
                v-else
                class="space-y-4"
            >
                <div
                    v-for="agent in agentRows ?? []"
                    :key="agent.id"
                    class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                >
                    <div class="sm:w-48 shrink-0">
                        <p class="font-medium">
                            {{ agent.name }}
                        </p>
                        <p
                            v-if="agent.description"
                            class="text-xs text-muted"
                        >
                            {{ agent.description }}
                        </p>
                    </div>
                    <USelectMenu
                        :model-value="agent.modelConfigKey"
                        :items="modelConfigOptions"
                        value-key="value"
                        :placeholder="t('mastraAdmin.selectModelConfig')"
                        size="lg"
                        class="w-full sm:flex-1"
                        @update:model-value="updateAgent(agent.id, { modelConfigKey: $event as string })"
                    />
                    <USelectMenu
                        :model-value="agent.promptKey"
                        :items="promptOptions"
                        value-key="value"
                        :placeholder="t('mastraAdmin.selectPrompt')"
                        size="lg"
                        class="w-full sm:flex-1"
                        @update:model-value="updateAgent(agent.id, { promptKey: $event as string | null })"
                    />
                </div>
            </div>
        </UCard>
    </div>
</template>
