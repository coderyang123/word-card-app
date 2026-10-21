import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Toast {
  message: string
  type: 'success' | 'error'
}

/** 全局 UI 状态：弹窗显隐 / 轻提示 */
export const useUiStore = defineStore('ui', () => {
  const showImport = ref(false)
  const showSettings = ref(false)
  const showResetConfirm = ref(false)
  const showClearConfirm = ref(false)
  const toast = ref<Toast | null>(null)

  let toastTimer: number | undefined

  function notify(message: string, type: Toast['type'] = 'success'): void {
    toast.value = { message, type }
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.value = null
    }, 2600)
  }

  /** 弹窗打开时屏蔽全局快捷键 */
  const anyModalOpen = computed(
    () =>
      showImport.value ||
      showSettings.value ||
      showResetConfirm.value ||
      showClearConfirm.value
  )

  return {
    showImport,
    showSettings,
    showResetConfirm,
    showClearConfirm,
    toast,
    anyModalOpen,
    notify
  }
})
