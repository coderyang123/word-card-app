/*
 * sync-types.ts — 云同步（GitHub 私有 Gist）的共享契约类型
 */

import type { VocabSettings, WordEntry } from './word-types'

/** 云端 Gist 中的文件名（主进程与渲染层共享常量） */
export const GIST_SYNC_FILENAME = 'wordcard.json'

/** Gist 自动发现用的 description 前缀 */
export const GIST_DESCRIPTION_PREFIX = 'WordCard 同步数据'

/** 云端 payload：version 1，为向后兼容预留 */
export interface SyncPayload {
  version: 1
  words: WordEntry[]
  settings: VocabSettings
  syncedAt: number
}

/** 本地同步配置状态（不暴露 token 明文） */
export interface SyncStatus {
  /** 本地是否已保存（加密的）Token */
  configured: boolean
  /** 已绑定的 Gist ID */
  gistId: string | null
  /** 上次同步时间（epoch ms） */
  lastSyncAt: number | null
  /** 本机是否支持 safeStorage 加密 */
  encryptionAvailable: boolean
}

export interface SaveTokenResult {
  ok: boolean
  /** Token 已保存但因网络原因未能验证 */
  warning?: string
  error?: string
}

export interface PullResult {
  ok: boolean
  /** 云端为空（无 Gist 或未绑定）时为 null */
  payload?: SyncPayload | null
  error?: string
}

export interface PushResult {
  ok: boolean
  syncedAt?: number
  gistId?: string
  /** 本次是否新创建了私有 Gist */
  created?: boolean
  error?: string
}
