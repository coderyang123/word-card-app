<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

defineProps<{
  open: boolean
  title: string
  description?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div class="absolute inset-0 bg-black/72 backdrop-blur-sm" @click="emit('close')" />
        <div
          class="modal-panel relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-black/50"
        >
          <header class="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-xs text-ink-faint">{{ description }}</p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-white/5 hover:text-ink"
              aria-label="关闭"
              @click="emit('close')"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div class="px-5 py-5">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
