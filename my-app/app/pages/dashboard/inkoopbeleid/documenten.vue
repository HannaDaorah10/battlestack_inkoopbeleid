<template>
    <OrganisationGate>
        <div class="space-y-6">
            <div>
                <h1 class="adj-page-title">
                    {{ t('inkoopbeleid.documents.title') }}
                </h1>
                <p class="mt-1.5 adj-lead">
                    {{ t('inkoopbeleid.documents.subtitle') }}
                </p>
            </div>

            <OrganisationSwitcher />

            <UCard>
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.documents.heading') }}
                    </h2>
                </template>

                <div class="space-y-3">
                    <UFormField
                        :label="t('inkoopbeleid.documents.fieldTitle')"
                        :description="t('inkoopbeleid.documents.fieldTitleHint')"
                        required
                    >
                        <UInput
                            v-model="form.title"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField :label="t('inkoopbeleid.documents.fieldKind')">
                        <USelect
                            v-model="form.kind"
                            :items="kindItems"
                            value-key="value"
                            class="w-full"
                        />
                    </UFormField>

                    <UFormField
                        :label="t('inkoopbeleid.documents.fieldFile')"
                        :description="t('inkoopbeleid.documents.fileHint')"
                    >
                        <div class="flex flex-wrap items-center gap-3">
                            <FileUpload
                                accept=".pdf,.docx,.txt,.md"
                                @uploaded="onUploaded"
                            />
                            <span
                                v-if="uploaded"
                                class="text-sm text-muted"
                            >
                                <UIcon
                                    name="i-lucide-check"
                                    class="text-success"
                                />
                                {{ uploaded.name }}
                            </span>
                        </div>
                    </UFormField>

                    <UButton
                        :loading="ingesting"
                        :disabled="!canIngest"
                        @click="onIngest"
                    >
                        {{ ingesting ? t('inkoopbeleid.documents.ingesting') : t('inkoopbeleid.documents.ingest') }}
                    </UButton>
                </div>
            </UCard>

            <UCard>
                <template #header>
                    <h2 class="adj-card-title">
                        {{ t('inkoopbeleid.documents.listHeading') }}
                    </h2>
                </template>

                <div
                    v-if="status === 'pending' && documents.length === 0"
                    class="space-y-2"
                >
                    <USkeleton
                        v-for="i in 3"
                        :key="i"
                        class="h-9 w-full"
                    />
                </div>

                <AdjEmptyState
                    v-else-if="documents.length === 0"
                    icon="i-lucide-file-text"
                    :title="t('inkoopbeleid.documents.empty')"
                />

                <UTable
                    v-else
                    :data="documents"
                    :columns="columns"
                    :loading="status === 'pending'"
                >
                    <template #kind-cell="{ row }">
                        <UBadge
                            color="neutral"
                            variant="subtle"
                        >
                            {{ t(`inkoopbeleid.documents.kinds.${row.original.kind}`) }}
                        </UBadge>
                    </template>
                    <template #chunkCount-cell="{ row }">
                        {{ t('inkoopbeleid.documents.chunkCount', { n: row.original.chunkCount }) }}
                    </template>
                    <template #ingestedAt-cell="{ row }">
                        {{ row.original.ingestedAt ? new Date(row.original.ingestedAt).toLocaleString(locale) : '-' }}
                    </template>
                </UTable>
            </UCard>
        </div>
    </OrganisationGate>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

interface DocumentRow {
    id: string
    title: string
    sourceLabel: string
    kind: string
    chunkCount: number
    ingestedAt: string | null
}

interface UploadedFile {
    key: string
    size: number
    mime: string | null
}

const { t, locale } = useI18n()
const toast = useToast()
const { organisationId } = await useOrganisations()

useHead({ title: () => t('inkoopbeleid.documents.title') })

const headers = useRequestHeaders(['cookie'])
const { data, status, refresh } = await useAsyncData<DocumentRow[]>(
    'inkoopbeleid-documents',
    () => {
        if (!organisationId.value) return Promise.resolve([])
        return $fetch('/api/inkoopbeleid/documents', {
            query: { organisationId: organisationId.value },
            headers,
        })
    },
    { watch: [organisationId], default: () => [] },
)
const documents = computed(() => data.value ?? [])

const KINDS = [
    'huidig_inkoopbeleid',
    'visie',
    'ondernemersplan',
    'audit',
    'mt_ambities',
    'referentie',
] as const

const kindItems = computed(() =>
    KINDS.map((k) => ({ label: t(`inkoopbeleid.documents.kinds.${k}`), value: k })),
)

const columns = computed<TableColumn<DocumentRow>[]>(() => [
    { accessorKey: 'title', header: t('inkoopbeleid.documents.columns.title') },
    { accessorKey: 'kind', header: t('inkoopbeleid.documents.columns.kind') },
    { accessorKey: 'chunkCount', header: t('inkoopbeleid.documents.columns.chunks') },
    { accessorKey: 'ingestedAt', header: t('inkoopbeleid.documents.columns.ingestedAt') },
])

type DocumentKind = typeof KINDS[number]

const form = reactive({ title: '', kind: 'huidig_inkoopbeleid' as DocumentKind })
const uploaded = ref<{ key: string, name: string } | null>(null)
const fileId = ref<string | null>(null)
const ingesting = ref(false)

const canIngest = computed(
    () => !!organisationId.value && !!fileId.value && form.title.trim().length > 0,
)

/**
 * The upload itself is the scaffold's existing two-step flow: `<FileUpload>` PUTs the bytes via
 * `/api/files/upload-url`, then `/api/files` records the row. Only once we hold a `files.id`
 * does the inkoopbeleid route get involved, so there is exactly one upload path in the app.
 */
async function onUploaded(file: UploadedFile) {
    try {
        const record = await $fetch<{ id: string }>('/api/files', {
            method: 'POST',
            body: { key: file.key },
        })
        fileId.value = record.id
        const name = file.key.split('/').pop() ?? file.key
        uploaded.value = { key: file.key, name }
        // A blank title is the common case here, and the filename is a better guess than nothing.
        if (!form.title.trim()) form.title = name.replace(/\.[^.]+$/, '')
        toast.add({ title: t('inkoopbeleid.documents.uploaded', { name }), color: 'success' })
    } catch (e) {
        toast.add({
            title: t('inkoopbeleid.error'),
            description: serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    }
}

async function onIngest() {
    if (!canIngest.value || !organisationId.value || !fileId.value) return
    ingesting.value = true
    try {
        const res = await $fetch<{ chunks: number, warnings: string[] }>(
            '/api/inkoopbeleid/documents',
            {
                method: 'POST',
                body: {
                    organisationId: organisationId.value,
                    fileId: fileId.value,
                    title: form.title.trim(),
                    kind: form.kind,
                },
            },
        )
        toast.add({
            title: t('inkoopbeleid.documents.success', { n: res.chunks, title: form.title.trim() }),
            color: 'success',
        })
        // Surfaced rather than swallowed: a converter warning is usually the first sign that a
        // table came through mangled, which is exactly the content that matters most here.
        if (res.warnings.length > 0) {
            toast.add({
                title: t('inkoopbeleid.documents.warnings', { messages: res.warnings.join('; ') }),
                color: 'warning',
            })
        }
        form.title = ''
        uploaded.value = null
        fileId.value = null
        await refresh()
    } catch (e) {
        // The server tags this one case, because "scan without a text layer" is a problem the
        // uploader can actually fix, and only if they can read the message.
        const code = (e as { data?: { code?: string } }).data?.code
        toast.add({
            title: t('inkoopbeleid.error'),
            description: code === 'document-no-text'
                ? t('inkoopbeleid.documents.noText')
                : serverErrorMessage(e, t('inkoopbeleid.error')),
            color: 'error',
            duration: 0,
        })
    } finally {
        ingesting.value = false
    }
}
</script>
