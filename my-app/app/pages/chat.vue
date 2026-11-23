<template>
    <div class="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col">
        <Chat />
    </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

useHead({ title: () => t('chat.title') })
</script>
