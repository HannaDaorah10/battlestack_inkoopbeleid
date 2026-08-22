<!--
  Lege toestand uit het Adjust design system: "Eén zin uitleg, één primaire
  actie. Geen illustraties of lange verhalen." En: nooit een lege tabel.

  Eén component in plaats van per scherm een <p>met wat grijze tekst, zodat elke
  lege lijst in de applicatie er hetzelfde uitziet.
-->
<template>
    <div
        class="flex flex-col items-center gap-1 rounded-sm border border-dashed border-accented bg-default px-6 py-8 text-center"
    >
        <UIcon
            v-if="icon"
            :name="icon"
            class="mb-1.5 size-[18px] text-dimmed"
        />
        <p class="text-base font-semibold text-highlighted">
            {{ title }}
        </p>
        <p
            v-if="description"
            class="max-w-md text-sm text-muted"
        >
            {{ description }}
        </p>
        <UButton
            v-if="actionLabel"
            class="mt-3"
            :to="actionTo"
            :icon="actionIcon"
            @click="onAction"
        >
            {{ actionLabel }}
        </UButton>
    </div>
</template>

<script setup lang="ts">
defineProps<{
    title: string
    description?: string
    icon?: string
    actionLabel?: string
    actionIcon?: string
    actionTo?: string
}>()

const emit = defineEmits<{ action: [] }>()

function onAction() {
    emit('action')
}
</script>
