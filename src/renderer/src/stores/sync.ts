import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUiStore } from './ui'
import { useVocabStore } from './vocab'
import { sanitizeSyncPayload } from '@/utils/mergeWords'
import type { SyncPayload } from '@shared/sync-types'

/**
 * 云同步状态机（GitHub 私有 Gist）。
 *
 * 安全边界：token 明文只在主进程（safeStorage 加密存 userData），
 * 本 store 只经 window.electronAPI 的 sync:* IPC 与主进程交互。
 */
export const useSyncStore = defineStore('sync', () => {
  // ---------- 状态 ----------
  const configured = ref(false)
  const gistId = ref<string | null>(null)
  const lastSyncAt = ref<number | null>(null)
  const encryptionAvailable = ref(true)
  const isSyncing = ref(false)
  /** 'pull' | 'push' | null —— 驱动按钮 loading 文案 */
  const syncingPhase = ref<'pull' | 'push' | null>(null)
  const lastError = ref<string | null>(null)
  /** PAT 输入框草稿，仅内存，保存后立即清空，永不持久化 */
  const tokenDraft = ref('')

  const ui = useUiStore()

  // ---------- 动作 ----------

  /** 从主进程读取同步配置状态 */
  async function init(): Promise<void> {
    if (!window.electronAPI) return
    const s = await window.electronAPI.syncGetStatus()
    configured.value = s.configured
    gistId.value = s.gistId
    lastSyncAt.value = s.lastSyncAt
    encryptionAvailable.value = s.encryptionAvailable
  }

  /** 保存 Token（主进程负责验证，401/403 会自动回滚） */
  async function saveToken(token: string): Promise<boolean> {
    if (!window.electronAPI) {
      lastError.value = '云同步仅在桌面端可用'
      return false
    }
    lastError.value = null
    const res = await window.electronAPI.syncSaveToken(token.trim())
    if (!res.ok) {
      lastError.value = res.error ?? '保存失败'
      return false
    }
    tokenDraft.value = ''
    await init()
    if (res.warning) {
      ui.notify(res.warning, 'error')
    } else {
      ui.notify('Token 已保存并通过验证')
    }
    return true
  }

  /**
   * 拉取并合并。silent 模式（启动自动拉取）下抑制失败 toast，
   * 仅记录 lastError 供设置页展示；有合并变化时始终提示。
   */
  async function pull(opts?: { silent?: boolean }): Promise<boolean> {
    if (!window.electronAPI || isSyncing.value) return false
    isSyncing.value = true
    syncingPhase.value = 'pull'
    lastError.value = null
    try {
      const res = await window.electronAPI.syncPull()
      if (!res.ok) throw new Error(res.error ?? '拉取失败')

      if (!res.payload) {
        if (!opts?.silent) ui.notify('云端暂无数据，请先上传')
        return true
      }

      const payload = sanitizeSyncPayload(res.payload)
      if (!payload) throw new Error('云端数据格式无效，可能已损坏')

      const vocab = useVocabStore()
      const { added, updated } = vocab.applySyncedWords(payload.words)
      vocab.applySyncedSettings(payload.settings)
      lastSyncAt.value = payload.syncedAt

      if (added + updated > 0) {
        ui.notify(`已从云端合并：新增 ${added} 词，更新 ${updated} 词`)
      } else if (!opts?.silent) {
        ui.notify('已是最新，无需合并')
      }
      return true
    } catch (err) {
      lastError.value = (err as Error).message
      if (!opts?.silent) ui.notify(lastError.value, 'error')
      return false
    } finally {
      isSyncing.value = false
      syncingPhase.value = null
    }
  }

  /** 上传本地词库 + 进度 + 设置（无 Gist 时自动创建私有 Gist） */
  async function push(): Promise<boolean> {
    if (!window.electronAPI || isSyncing.value) return false
    isSyncing.value = true
    syncingPhase.value = 'push'
    lastError.value = null
    try {
      const vocab = useVocabStore()
      const payload: SyncPayload = {
        version: 1,
        words: vocab.words,
        settings: vocab.settings,
        syncedAt: Date.now()
      }
      const res = await window.electronAPI.syncPush(payload)
      if (!res.ok) throw new Error(res.error ?? '上传失败')

      lastSyncAt.value = res.syncedAt ?? Date.now()
      gistId.value = res.gistId ?? gistId.value
      ui.notify(res.created ? '已创建私有 Gist 并上传' : '上传成功')
      return true
    } catch (err) {
      lastError.value = (err as Error).message
      ui.notify(lastError.value, 'error')
      return false
    } finally {
      isSyncing.value = false
      syncingPhase.value = null
    }
  }

  return {
    configured,
    gistId,
    lastSyncAt,
    encryptionAvailable,
    isSyncing,
    syncingPhase,
    lastError,
    tokenDraft,
    init,
    saveToken,
    pull,
    push
  }
})
