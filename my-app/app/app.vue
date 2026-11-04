<template>
    <!-- Toast rechtsonder, succes verdwijnt na 4 seconden. Een fout-toast geeft
         `duration: 0` mee op de aanroep, want die blijft staan tot hij wordt
         weggeklikt. -->
    <UApp
        :toaster="{ duration: 4000 }"
        :locale="uiLocale"
    >
        <NuxtLoadingIndicator :color="loadingIndicatorColor" />
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>

<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'

// Nuxt UI heeft eigen teksten (lege lijsten, "Create ..." in een keuzemenu, sluitknoppen). Zonder
// deze koppeling stonden die in het Engels in een verder Nederlandse app.
const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'en' ? en : nl))
// Adjust-rood: de laadbalk is een signaal, geen tekst — daar mag het accent staan.
const loadingIndicatorColor = 'var(--adj-rood)'

useHead({
    link: [
        { rel: 'icon', type: 'image/png', href: '/favicon-32.png', sizes: '32x32' },
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
    ],
    meta: [
        // Literal hex, not the token: browsers read this before any stylesheet
        // and never resolve a CSS variable here. Waarde = --adj-rood.
        { name: 'theme-color', content: '#CF2C28' },
    ],
})
</script>
