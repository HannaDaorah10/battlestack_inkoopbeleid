<template>
    <div />
</template>

<script setup lang="ts">
// De homepagina is de bouwsteen Inkoopbeleid. Hier stond nog de scaffoldtekst ("This project
// was scaffolded with battlestack"), die zichtbaar werd via het logo. Niet-ingelogde bezoekers
// gaan via `auth.global.ts` eerst naar /login.
definePageMeta({
    middleware: () => navigateTo('/dashboard/inkoopbeleid', { replace: true }),
})
</script>
