<script setup lang="ts">
import BaseModal from './BaseModal.vue'

defineProps<{
  open: boolean
  title: string
  description?: string
  message: string
  confirmText?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'close'): void
}>()
</script>

<template>
  <BaseModal :open="open" :title="title" :description="description" @close="emit('close')">
    <p class="text-sm leading-relaxed text-ink-muted">
      {{ message }}
    </p>
    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-line px-4 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft"
        @click="emit('close')"
      >
        取消
      </button>
      <button
        type="button"
        class="rounded-xl border border-danger/50 bg-danger/10 px-4 py-2 text-xs font-medium text-danger transition hover:bg-danger/15"
        @click="emit('confirm')"
      >
        {{ confirmText ?? '确认' }}
      </button>
    </template>
  </BaseModal>
</template>
