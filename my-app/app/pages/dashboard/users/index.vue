<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ middleware: 'admin' })

interface UserRow {
    id: string
    name: string
    email: string
    role: 'admin' | 'user'
    createdAt: string
}

interface UserList {
    rows: UserRow[]
    total: number
    limit: number
    offset: number
}

const { t, locale } = useI18n()
const PAGE_SIZE = 50
const search = ref('')
const page = ref(0)
// SSR cookie forward: `requireRole` 401s otherwise.
const headers = useRequestHeaders(['cookie'])
const { data, status, refresh } = await useAsyncData<UserList>(
    'users-admin-list',
    () =>
        $fetch('/api/users', {
            query: {
                search: search.value || undefined,
                limit: PAGE_SIZE,
                offset: page.value * PAGE_SIZE,
            },
            headers,
        }),
    { watch: [search, page] },
)
watch(search, () => (page.value = 0))
const pageCount = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)))

const columns = computed<TableColumn<UserRow>[]>(() => [
    { accessorKey: 'email', header: t('userAdmin.columns.email') },
    { accessorKey: 'name', header: t('userAdmin.columns.name') },
    { accessorKey: 'role', header: t('userAdmin.columns.role') },
    { accessorKey: 'createdAt', header: t('userAdmin.columns.createdAt') },
])

const roleItems = computed(() => [
    { label: t('userAdmin.roles.user'), value: 'user' },
    { label: t('userAdmin.roles.admin'), value: 'admin' },
])

const toast = useToast()
const showCreate = ref(false)
const newUser = reactive({ email: '', password: '', name: '', role: 'user' as 'admin' | 'user' })
const createError = ref('')

// Lege lijst met een zoekterm erin krijgt "wis de zoekopdracht"; zonder
// zoekterm de eerste actie. Zo heeft elke lege toestand precies één knop.
function onEmptyAction() {
    if (search.value) search.value = ''
    else showCreate.value = true
}

async function createUser() {
    createError.value = ''
    try {
        await $fetch('/api/users', { method: 'POST', body: newUser })
        showCreate.value = false
        Object.assign(newUser, { email: '', password: '', name: '', role: 'user' })
        await refresh()
        toast.add({ title: t('userAdmin.create.successTitle'), color: 'success' })
    } catch (e) {
        const msg
            = (e as { statusMessage?: string, message?: string }).statusMessage
                || (e as Error).message
                || t('userAdmin.create.failed')
        createError.value = msg
        // Een fout-toast blijft staan tot hij wordt weggeklikt; de invoer in de
        // modal blijft bewaard zodat niemand opnieuw hoeft te typen.
        toast.add({
            title: t('userAdmin.create.failedTitle'),
            description: msg,
            color: 'error',
            duration: 0,
        })
    }
}
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
            <h1 class="adj-page-title">
                {{ t('userAdmin.title') }}
            </h1>
            <UButton
                icon="i-lucide-plus"
                @click="showCreate = true"
            >
                {{ t('userAdmin.new') }}
            </UButton>
        </div>

        <UCard>
            <UInput
                v-model="search"
                type="search"
                :placeholder="t('userAdmin.searchPlaceholder')"
                icon="i-lucide-search"
                autocomplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                class="mb-4 w-full sm:max-w-xs"
            />

            <!-- Skeleton bij het eerste laden, in de vorm van de rijen die komen. -->
            <div
                v-if="status === 'pending' && !data"
                class="space-y-2"
            >
                <USkeleton
                    v-for="i in 5"
                    :key="i"
                    class="h-9 w-full"
                />
            </div>

            <!-- Geen items? De lege toestand — nooit een lege tabel. -->
            <AdjEmptyState
                v-else-if="(data?.rows.length ?? 0) === 0"
                icon="i-lucide-users"
                :title="search
                    ? t('userAdmin.empty.noResults', { query: search })
                    : t('userAdmin.empty.title')"
                :description="search ? undefined : t('userAdmin.empty.description')"
                :action-label="search ? t('userAdmin.empty.clearSearch') : t('userAdmin.new')"
                :action-icon="search ? 'i-lucide-x' : 'i-lucide-plus'"
                @action="onEmptyAction"
            />

            <UTable
                v-else
                :data="data?.rows ?? []"
                :columns="columns"
                :loading="status === 'pending'"
            >
                <template #email-cell="{ row }">
                    <NuxtLink
                        :to="`/dashboard/users/${row.original.id}`"
                        class="adj-link"
                    >
                        {{ row.original.email }}
                    </NuxtLink>
                </template>
                <template #role-cell="{ row }">
                    <UBadge :color="row.original.role === 'admin' ? 'info' : 'neutral'">
                        {{ t(`userAdmin.roles.${row.original.role}`) }}
                    </UBadge>
                </template>
                <template #createdAt-cell="{ row }">
                    {{ new Date(row.original.createdAt).toLocaleDateString(locale) }}
                </template>
            </UTable>

            <div
                v-if="(data?.total ?? 0) > PAGE_SIZE"
                class="mt-4 flex items-center justify-between gap-4"
            >
                <span class="text-sm text-muted tabular-nums">
                    {{
                        t('userAdmin.pagination.range', {
                            from: page * PAGE_SIZE + 1,
                            to: Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0),
                            total: data?.total ?? 0,
                        })
                    }}
                </span>
                <div class="flex gap-2">
                    <UButton
                        :disabled="page === 0"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="page--"
                    >
                        {{ t('userAdmin.pagination.previous') }}
                    </UButton>
                    <UButton
                        :disabled="page >= pageCount - 1"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        @click="page++"
                    >
                        {{ t('userAdmin.pagination.next') }}
                    </UButton>
                </div>
            </div>
        </UCard>

        <!-- Kort formulier (≤ 5 velden) hoort in een modal: de gebruiker blijft
             in context en de primaire knop benoemt de actie. -->
        <UModal
            v-model:open="showCreate"
            :title="t('userAdmin.create.title')"
        >
            <template #body>
                <form
                    id="create-user-form"
                    class="space-y-4"
                    @submit.prevent="createUser"
                >
                    <UFormField
                        :label="t('userAdmin.create.email')"
                        required
                    >
                        <UInput
                            v-model="newUser.email"
                            type="email"
                            required
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField :label="t('userAdmin.create.name')">
                        <UInput
                            v-model="newUser.name"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        :label="t('userAdmin.create.password')"
                        required
                    >
                        <UInput
                            v-model="newUser.password"
                            type="password"
                            required
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField :label="t('userAdmin.create.role')">
                        <USelect
                            v-model="newUser.role"
                            :items="roleItems"
                            class="w-full"
                        />
                    </UFormField>
                    <p
                        v-if="createError"
                        class="text-xs text-error"
                    >
                        {{ createError }}
                    </p>
                </form>
            </template>
            <!-- Secundair links van de primaire actie. -->
            <template #footer>
                <div class="flex w-full justify-end gap-2.5">
                    <UButton
                        color="neutral"
                        variant="outline"
                        @click="showCreate = false"
                    >
                        {{ t('userAdmin.create.cancel') }}
                    </UButton>
                    <UButton
                        type="submit"
                        form="create-user-form"
                    >
                        {{ t('userAdmin.create.submit') }}
                    </UButton>
                </div>
            </template>
        </UModal>
    </div>
</template>
