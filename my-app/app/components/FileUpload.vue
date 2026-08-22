<template>
    <div class="space-y-2">
        <input
            ref="input"
            type="file"
            class="hidden"
            :accept="accept"
            @change="onChange"
        />
        <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-upload"
            :loading="uploading"
            :disabled="uploading"
            @click="input?.click()"
        >
            {{ uploading ? t('common.actions.uploading', { progress }) : t('common.actions.chooseFile') }}
        </UButton>
        <p
            v-if="error"
            class="text-xs text-error"
        >
            {{ error }}
        </p>
    </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

defineProps<{ accept?: string }>()
const emit = defineEmits<{ uploaded: [file: { key: string, size: number, mime: string | null }] }>()

const input = ref<HTMLInputElement | null>(null)
const { upload, uploading, progress, error } = useS3Upload()

async function onChange(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    try {
        const record = await upload(file)
        emit('uploaded', record)
    } finally {
        if (target) target.value = ''
    }
}
</script>
