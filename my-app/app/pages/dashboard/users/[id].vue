<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface UserRow {
    id: string
    name: string
    email: string
    role: 'admin' | 'user'
    createdAt: string
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const userId = computed(() => String(route.params.id))
const { user: sessionUser } = useUserSession()
// SSR cookie forward: admin-gated API.
const headers = useRequestHeaders(['cookie'])

const { data: user, status, refresh } = await useAsyncData<UserRow>(
    () => `user-${userId.value}`,
    () => $fetch(`/api/users/${userId.value}`, { headers }),
)

const form = reactive({
    email: '',
    name: '',
    password: '',
    role: 'user' as 'admin' | 'user',
})
const formError = ref('')
const showDelete = ref(false)
const saving = ref(false)
const deleting = ref(false)

const roleItems = computed(() => [
    { label: t('userAdmin.roles.user'), value: 'user' },
    { label: t('userAdmin.roles.admin'), value: 'admin' },
])

watchEffect(() => {
    if (!user.value) return
    form.email = user.value.email
    form.name = user.value.name
    form.role = user.value.role
})

const isSelf = computed(() => (sessionUser.value as { id?: string } | null)?.id === userId.value)

async function save() {
    formError.value = ''
    saving.value = true
    try {
        const patch: Record<string, unknown> = {
            email: form.email,
            name: form.name,
            role: form.role,
        }
        if (form.password) patch.password = form.password
        await $fetch(`/api/users/${userId.value}`, { method: 'PUT', body: patch })
        form.password = ''
        await refresh()
        toast.add({ title: t('userAdmin.edit.savedTitle'), color: 'success' })
    } catch (e) {
        const msg
            = (e as { statusMessage?: string, message?: string }).statusMessage
                || (e as Error).message
                || t('userAdmin.edit.saveFailed')
        formError.value = msg
        // Blijft staan tot hij wordt weggeklikt; de ingevulde velden blijven staan.
        toast.add({
            title: t('userAdmin.edit.saveFailedTitle'),
            description: msg,
            color: 'error',
            duration: 0,
        })
    } finally {
        saving.value = false
    }
}

async function destroy() {
    deleting.value = true
    try {
        await $fetch(`/api/users/${userId.value}`, { method: 'DELETE' })
        toast.add({ title: t('userAdmin.edit.deletedTitle'), color: 'success' })
        router.push('/dashboard/users')
    } catch (e) {
        const msg
            = (e as { statusMessage?: string, message?: string }).statusMessage
                || (e as Error).message
                || t('userAdmin.edit.deleteFailed')
        formError.value = msg
        showDelete.value = false
        toast.add({
            title: t('userAdmin.edit.deleteFailedTitle'),
            description: msg,
            color: 'error',
            duration: 0,
        })
    } finally {
        deleting.value = false
    }
}
</script>

<template>
    <div class="space-y-6">
        <div>
            <UButton
                to="/dashboard/users"
                color="neutral"
                variant="link"
                icon="i-lucide-arrow-left"
                class="mb-1 -ml-1"
            >
                {{ t('userAdmin.edit.back') }}
            </UButton>
            <h1 class="adj-page-title">
                {{ t('userAdmin.edit.title') }}
            </h1>
            <p
                v-if="user"
                class="mt-1.5 adj-lead"
            >
                {{ user.email }}
            </p>
        </div>

        <UCard>
            <!-- Skeleton bij het eerste laden — nooit een leeg scherm. -->
            <div
                v-if="status === 'pending' && !user"
                class="space-y-4"
            >
                <USkeleton
                    v-for="i in 4"
                    :key="i"
                    class="h-14 w-full"
                />
            </div>

            <!-- Lang formulier (> 5 velden zou een eigen pagina zijn); dit is er
                 al een, dus: één kolom, acties onderaan. -->
            <form
                v-else-if="user"
                class="space-y-4"
                @submit.prevent="save"
            >
                <UFormField
                    :label="t('userAdmin.create.email')"
                    required
                >
                    <UInput
                        v-model="form.email"
                        type="email"
                        required
                        class="w-full"
                    />
                </UFormField>
                <UFormField :label="t('userAdmin.create.name')">
                    <UInput
                        v-model="form.name"
                        class="w-full"
                    />
                </UFormField>
                <UFormField :label="t('userAdmin.edit.passwordPlaceholder')">
                    <UInput
                        v-model="form.password"
                        type="password"
                        class="w-full"
                    />
                </UFormField>
                <UFormField :label="t('userAdmin.create.role')">
                    <USelect
                        v-model="form.role"
                        :items="roleItems"
                        class="w-full sm:max-w-xs"
                    />
                </UFormField>
                <p
                    v-if="formError"
                    class="text-xs text-error"
                >
                    {{ formError }}
                </p>
                <div class="flex justify-between gap-2 border-t border-muted pt-4">
                    <UButton
                        v-if="!isSelf"
                        color="neutral"
                        variant="link"
                        icon="i-lucide-trash-2"
                        @click="showDelete = true"
                    >
                        {{ t('userAdmin.edit.delete') }}
                    </UButton>
                    <span v-else />
                    <UButton
                        type="submit"
                        icon="i-lucide-save"
                        :loading="saving"
                        :disabled="saving"
                    >
                        {{ t('userAdmin.edit.save') }}
                    </UButton>
                </div>
            </form>
        </UCard>

        <!-- Destructieve bevestiging: benoemt het object en het gevolg, en de
             rode knop zegt wat er gebeurt. -->
        <UModal
            v-model:open="showDelete"
            :title="t('userAdmin.edit.deleteTitle')"
        >
            <template #body>
                <i18n-t
                    keypath="userAdmin.edit.deleteConfirm"
                    tag="p"
                    class="text-base"
                >
                    <template #email>
                        <b>{{ user?.email }}</b>
                    </template>
                </i18n-t>
            </template>
            <template #footer>
                <div class="flex w-full justify-end gap-2.5">
                    <UButton
                        color="neutral"
                        variant="outline"
                        @click="showDelete = false"
                    >
                        {{ t('userAdmin.edit.cancel') }}
                    </UButton>
                    <UButton
                        color="error"
                        :loading="deleting"
                        :disabled="deleting"
                        @click="destroy"
                    >
                        {{ t('userAdmin.edit.deleteConfirmAction') }}
                    </UButton>
                </div>
            </template>
        </UModal>
    </div>
</template>
