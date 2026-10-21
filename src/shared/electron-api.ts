/** 主进程 / 预加载 / 渲染层共享的 IPC 契约类型 */

import type {
  PullResult,
  PushResult,
  SaveTokenResult,
  SyncPayload,
  SyncStatus
} from './sync-types'

export interface OpenJsonResult {
  ok: boolean
  content?: string
  fileName?: string
  error?: string
}

export interface SaveJsonResult {
  ok: boolean
  filePath?: string
  error?: string
}

export interface ElectronAPI {
  /** 运行平台，如 win32 / darwin / linux */
  platform: string
  /** 打开系统文件选择器读取 JSON 文本 */
  openJsonFile: () => Promise<OpenJsonResult>
  /** 打开系统保存对话框写入 JSON 文本 */
  saveJsonFile: (defaultName: string, content: string) => Promise<SaveJsonResult>

  // ---------- 云同步（GitHub 私有 Gist） ----------
  /** 读取本地同步配置状态（不含 token 明文） */
  syncGetStatus: () => Promise<SyncStatus>
  /** 保存并验证 Token */
  syncSaveToken: (token: string) => Promise<SaveTokenResult>
  /** 从云端 Gist 拉取数据 */
  syncPull: () => Promise<PullResult>
  /** 上传本地数据到云端 Gist */
  syncPush: (payload: SyncPayload) => Promise<PushResult>
}
