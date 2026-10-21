<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useVocabStore } from '@/stores/vocab'
import { useUiStore } from '@/stores/ui'
import { useSyncStore } from '@/stores/sync'
import BaseModal from './BaseModal.vue'

const store = useVocabStore()
const ui = useUiStore()
const sync = useSyncStore()
const { settings, words } = storeToRefs(store)

const orderOptions = computed(() => [
  { value: 'sequential' as const, label: '顺序播放', desc: '按词库原始顺序' },
  { value: 'random' as const, label: '随机乱序', desc: '每次切换顺序后重新洗牌' }
])

// 云同步状态行
const statusDotClass = computed(() => {
  if (!sync.encryptionAvailable) return 'bg-danger'
  if (sync.lastError) return 'bg-warn'
  return sync.configured ? 'bg-accent' : 'bg-ink-faint'
})

const statusText = computed(() => {
  if (!sync.encryptionAvailable) return '当前系统不支持加密存储，无法安全保存 Token'
  if (!sync.configured) return '未配置 · 保存 Token 后启用多设备同步'
  const shortId = sync.gistId ? `${sync.gistId.slice(0, 8)}…` : '自动发现'
  const time = sync.lastSyncAt ? formatTime(sync.lastSyncAt) : '从未同步'
  return `已绑定 Gist ${shortId} · 上次同步 ${time}`
})

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

async function onSaveToken(): Promise<void> {
  await sync.saveToken(sync.tokenDraft)
}

async function exportWords(): Promise<void> {
  const content = store.exportWords()
  if (window.electronAPI) {
    const result = await window.electronAPI.saveJsonFile('wordcard-vocabulary.json', content)
    if (result.ok) {
      ui.notify(`已导出到 ${result.filePath ?? '本地文件'}`)
    }
    return
  }
  // 浏览器环境回退：下载文件
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'wordcard-vocabulary.json'
  a.click()
  URL.revokeObjectURL(url)
  ui.notify('已导出 JSON 文件')
}

function close(): void {
  ui.showSettings = false
}

onMounted(() => {
  void sync.init()
})
</script>

<template>
  <BaseModal :open="ui.showSettings" title="设置" description="播放偏好与数据管理" @close="close">
    <!-- 播放顺序 -->
    <section>
      <h3 class="section-label">播放顺序</h3>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button
          v-for="opt in orderOptions"
          :key="opt.value"
          type="button"
          class="rounded-xl border px-3 py-2.5 text-left transition"
          :class="
            settings.order === opt.value
              ? 'border-accent/50 bg-accent/10'
              : 'border-line hover:border-line-strong'
          "
          @click="store.updateSettings({ order: opt.value })"
        >
          <span class="block text-sm font-medium" :class="settings.order === opt.value ? 'text-accent' : 'text-ink-soft'">
            {{ opt.label }}
          </span>
          <span class="mt-0.5 block text-[11px] text-ink-faint">{{ opt.desc }}</span>
        </button>
      </div>
    </section>

    <!-- 默认展开答案 -->
    <section class="mt-6">
      <div class="flex items-center justify-between rounded-xl border border-line bg-base px-4 py-3">
        <div>
          <p class="text-sm text-ink-soft">进入卡片时默认展开答案</p>
          <p class="mt-0.5 text-[11px] text-ink-faint">关闭时为翻卡记忆模式，按空格翻转</p>
        </div>
        <button
          type="button"
          role="switch"
          :aria-checked="settings.showAnswerByDefault"
          class="relative h-6 w-11 shrink-0 rounded-full border transition"
          :class="settings.showAnswerByDefault ? 'border-accent/60 bg-accent/30' : 'border-line bg-card-hover'"
          @click="store.updateSettings({ showAnswerByDefault: !settings.showAnswerByDefault })"
        >
          <span
            class="absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all"
            :class="settings.showAnswerByDefault ? 'left-[22px] bg-accent' : 'left-0.5 bg-ink-faint'"
          />
        </button>
      </div>
    </section>

    <!-- 数据管理 -->
    <section class="mt-6">
      <h3 class="section-label">数据管理</h3>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl border border-line px-3 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft"
          @click="exportWords"
        >
          导出生词库（{{ words.length }} 词）
        </button>
        <button
          type="button"
          class="rounded-xl border border-danger/40 px-3 py-2 text-xs text-danger transition hover:bg-danger/10"
          @click="ui.showResetConfirm = true"
        >
          重置学习进度
        </button>
        <button
          type="button"
          class="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger/15"
          @click="ui.showClearConfirm = true"
        >
          清空词库（{{ words.length }} 词）
        </button>
      </div>
      <p class="mt-2 text-[11px] leading-relaxed text-ink-faint">
        词库与学习进度保存在浏览器 localStorage（wordcard:words:v1），词库完全由你导入的 JSON 构成。
      </p>
    </section>

    <!-- 云同步（GitHub 私有 Gist） -->
    <section class="mt-6">
      <h3 class="section-label">云同步</h3>

      <!-- 状态行 -->
      <div class="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-base px-4 py-3">
        <span class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass" />
        <p class="text-sm text-ink-soft">{{ statusText }}</p>
      </div>

      <!-- Token 输入 + 保存 -->
      <div class="mt-2 flex gap-2">
        <input
          v-model="sync.tokenDraft"
          type="password"
          placeholder="粘贴 GitHub Token（github_pat_…）"
          autocomplete="off"
          :disabled="sync.isSyncing || !sync.encryptionAvailable"
          class="min-w-0 flex-1 rounded-xl border border-line bg-base px-3 py-2 text-xs text-ink-soft placeholder:text-ink-faint focus:border-accent/50 focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          :disabled="sync.isSyncing || sync.tokenDraft.trim().length === 0 || !sync.encryptionAvailable"
          class="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/15 disabled:opacity-40"
          @click="onSaveToken"
        >
          保存
        </button>
      </div>

      <!-- 拉取 / 上传 -->
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="!sync.configured || sync.isSyncing"
          class="rounded-xl border border-line px-3 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft disabled:opacity-40"
          @click="sync.pull()"
        >
          {{ sync.syncingPhase === 'pull' ? '拉取中…' : '立即拉取' }}
        </button>
        <button
          type="button"
          :disabled="!sync.configured || sync.isSyncing"
          class="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/15 disabled:opacity-40"
          @click="sync.push()"
        >
          {{ sync.syncingPhase === 'push' ? '上传中…' : '立即上传' }}
        </button>
      </div>

      <!-- 错误行 -->
      <p
        v-if="sync.lastError"
        class="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
      >
        {{ sync.lastError }}
      </p>

      <p class="mt-2 text-[11px] leading-relaxed text-ink-faint">
        通过 GitHub 私有 Gist 在多设备间同步词库、学习进度与设置。Token 经本机系统加密（Windows
        DPAPI）后存放，明文不落盘。创建 Token：github.com/settings/tokens?type=beta，权限勾选「Gists:
        write」。首次上传自动创建私有 Gist，其他设备填入同一 Token 即可自动绑定。
        注意：删除单词的操作不会同步（其他设备重新拉取时可能复活）；同步依赖本机时钟判断新旧。
      </p>
    </section>

    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/15"
        @click="close"
      >
        完成
      </button>
    </template>
  </BaseModal>
</template>
