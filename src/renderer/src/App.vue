<script setup lang="ts">
import { onMounted } from 'vue'
import TitleBar from '@/components/TitleBar.vue'
import HomeView from '@/views/HomeView.vue'
import ImportDialog from '@/components/ImportDialog.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useVocabStore } from '@/stores/vocab'
import { useUiStore } from '@/stores/ui'
import { useSyncStore } from '@/stores/sync'

const store = useVocabStore()
const ui = useUiStore()
const sync = useSyncStore()

function onResetConfirm(): void {
  store.resetProgress()
  ui.showResetConfirm = false
  ui.showSettings = false
  ui.notify('学习进度已重置')
}

function onClearConfirm(): void {
  const count = store.words.length
  store.clearAll()
  ui.showClearConfirm = false
  ui.showSettings = false
  ui.notify(`已清空 ${count} 个单词`)
}

// 启动时自动拉取云端合并（未配置则完全静默，零网络请求）
onMounted(async () => {
  if (!window.electronAPI) return
  await sync.init()
  if (!sync.configured) return
  await sync.pull({ silent: true })
})
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-base text-ink">
    <TitleBar />
    <HomeView class="min-h-0 flex-1" />
    <ImportDialog />
    <SettingsDialog />

    <!-- 重置学习进度确认 -->
    <ConfirmDialog
      :open="ui.showResetConfirm"
      title="重置学习进度？"
      description="此操作不可撤销"
      message="所有单词的状态将回到「未学」，复习次数与评级记录清零。已导入的词库内容会保留。"
      confirm-text="确认重置"
      @confirm="onResetConfirm"
      @close="ui.showResetConfirm = false"
    />

    <!-- 清空词库确认 -->
    <ConfirmDialog
      :open="ui.showClearConfirm"
      title="清空词库？"
      description="此操作不可撤销"
      :message="`将删除全部 ${store.words.length} 个单词，之后可重新导入 JSON 词库。`"
      confirm-text="确认清空"
      @confirm="onClearConfirm"
      @close="ui.showClearConfirm = false"
    />

    <!-- 全局轻提示 -->
    <Teleport to="body">
      <Transition name="fade-up">
        <div
          v-if="ui.toast"
          class="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur"
          :class="
            ui.toast.type === 'success'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-danger/40 bg-danger/10 text-danger'
          "
        >
          {{ ui.toast.message }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
