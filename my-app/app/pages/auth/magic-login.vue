<template>
    <div class="space-y-6">
        <h1 class="adj-card-title">
            {{ error ? t('auth.magicLogin.failed') : t('auth.magicLogin.title') }}
        </h1>

        <div
            v-if="error"
            class="space-y-3 text-center"
        >
            <p class="text-sm text-muted">
                {{ error }}
            </p>
        </div>
        <div
            v-else
            class="flex items-center gap-3 justify-center py-2"
        >
            <UIcon
                name="i-lucide-loader-2"
                class="h-5 w-5 animate-spin text-primary"
            />
            <p class="text-sm text-muted">
                {{ t('auth.magicLogin.signingIn') }}
            </p>
        </div>

        <UButton
            v-if="error"
            to="/login"
            color="neutral"
            variant="outline"
            block
        >
            {{ t('auth.magicLogin.toLogin') }}
        </UButton>
    </div>
</template>

<script setup lang="ts">
// Opened by `battlestack login`/`battlestack uli`; POSTs the token to `/api/auth/magic-login`, which verifies the HMAC and sets the session cookie.
// Being a real Vue route (not a 404) avoids a `[Vue Router warn]: No match found` when the browser lands here.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const error = ref<string | null>(null)

onMounted(async () => {
    const token = typeof route.query.token === 'string' ? route.query.token : ''
    const sig = typeof route.query.sig === 'string' ? route.query.sig : ''
    if (!token || !sig) {
        error.value = t('auth.magicLogin.errors.missing')
        return
    }
    try {
        await $fetch('/api/auth/magic-login', {
            method: 'POST',
            body: { token, sig },
        })
        // Re-fetch the session client-side before navigating: `useUserSession().loggedIn` otherwise still reads the
        // SSR payload hydrated without the cookie, so auth.global.ts middleware bounces back to /login on first visit.
        await refreshSession()
        await navigateTo('/dashboard')
    } catch (e: unknown) {
        error.value = serverErrorMessage(e, t('auth.magicLogin.errors.generic'))
    }
})
</script>
