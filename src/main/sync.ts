import { app, ipcMain, safeStorage } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  PullResult,
  PushResult,
  SaveTokenResult,
  SyncPayload,
  SyncStatus
} from '@shared/sync-types'
import { GIST_DESCRIPTION_PREFIX, GIST_SYNC_FILENAME } from '@shared/sync-types'

/** GitHub REST API 基础地址 */
const API_BASE = 'https://api.github.com'
/** 网络请求超时（国内访问 GitHub 不稳定，给足时间但要有上限） */
const REQUEST_TIMEOUT_MS = 15_000

/** 本地同步配置（token 加密后存放，明文不落盘） */
interface SyncConfig {
  gistId?: string
  /** safeStorage 加密后的 base64 */
  encryptedToken?: string
  lastSyncAt?: number
}

function configPath(): string {
  return join(app.getPath('userData'), 'sync-config.json')
}

async function loadConfig(): Promise<SyncConfig> {
  try {
    const raw = await readFile(configPath(), 'utf-8')
    return JSON.parse(raw) as SyncConfig
  } catch {
    return {}
  }
}

async function saveConfig(config: SyncConfig): Promise<void> {
  await writeFile(configPath(), JSON.stringify(config, null, 2), 'utf-8')
}

/** 加密 token；本机不支持加密时返回 null */
function encryptToken(plain: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.encryptString(plain).toString('base64')
  } catch {
    return null
  }
}

/** 解密 token；换用户/重装导致 DPAPI 密文失效时返回 null */
function decryptToken(base64: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(base64, 'base64'))
  } catch {
    return null
  }
}

/** HTTP 状态码 → 用户可读的错误文案 */
function mapHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return 'Token 无效或权限不足（需要 Gists: write 权限）'
  }
  if (status === 404) return 'Gist 不存在或已被删除'
  if (status === 429) return 'GitHub API 触发限流，请稍后再试'
  if (status >= 500) return 'GitHub 服务暂时不可用，请稍后再试'
  return `网络请求失败（HTTP ${status}）`
}

/** 带认证与超时的 GitHub API 请求；非 2xx 抛出映射后的友好错误 */
async function ghFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.headers ?? {})
      }
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('网络连接超时，请检查网络后重试')
    }
    throw new Error('网络连接失败，请检查网络后重试')
  }
  if (!response.ok) {
    throw new Error(mapHttpError(response.status))
  }
  return response
}

interface GistFile {
  filename: string
  content?: string
  truncated?: boolean
  raw_url?: string
}

interface GistResponse {
  id: string
  description?: string | null
  files?: Record<string, GistFile>
}

/**
 * 查找或创建同步专用 Gist：
 * 1. GET /gists 按 description 前缀自动发现（多设备无需手动复制 ID）
 * 2. 未找到且允许创建 → POST 创建私有 Gist（种子内容为合法空 payload）
 */
async function findOrCreateGist(
  token: string,
  opts: { create: boolean }
): Promise<{ id: string; created: boolean } | null> {
  const listResponse = await ghFetch(token, '/gists?per_page=100')
  const gists = (await listResponse.json()) as GistResponse[]
  const existing = gists.find((g) => (g.description ?? '').startsWith(GIST_DESCRIPTION_PREFIX))
  if (existing) {
    return { id: existing.id, created: false }
  }
  if (!opts.create) return null

  const seed: SyncPayload = {
    version: 1,
    words: [],
    settings: { order: 'sequential', showAnswerByDefault: false },
    syncedAt: 0
  }
  const createResponse = await ghFetch(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: `${GIST_DESCRIPTION_PREFIX}（由 WordCard 自动创建）`,
      public: false,
      files: { [GIST_SYNC_FILENAME]: { content: JSON.stringify(seed, null, 2) } }
    })
  })
  const created = (await createResponse.json()) as GistResponse
  return { id: created.id, created: true }
}

/** 读取 Gist 中的同步文件内容（truncated 时回退 raw_url） */
async function readSyncFile(token: string, gistId: string): Promise<string> {
  const response = await ghFetch(token, `/gists/${gistId}`)
  const gist = (await response.json()) as GistResponse
  const file = gist.files?.[GIST_SYNC_FILENAME]
  if (!file) {
    throw new Error(`云端 Gist 中不存在 ${GIST_SYNC_FILENAME} 文件`)
  }
  if (file.truncated && file.raw_url) {
    const rawResponse = await ghFetch(token, file.raw_url.replace(API_BASE, ''))
    return rawResponse.text()
  }
  return file.content ?? ''
}

/** 取当前 token；未配置或解密失败返回 null（调用方转友好错误） */
async function resolveToken(): Promise<string | null> {
  const config = await loadConfig()
  if (!config.encryptedToken) return null
  return decryptToken(config.encryptedToken)
}

function registerSyncIpc(): void {
  // 本地同步配置状态（不含 token 明文）
  ipcMain.handle('sync:getStatus', async (): Promise<SyncStatus> => {
    const config = await loadConfig()
    return {
      configured: !!config.encryptedToken,
      gistId: config.gistId ?? null,
      lastSyncAt: config.lastSyncAt ?? null,
      encryptionAvailable: safeStorage.isEncryptionAvailable()
    }
  })

  // 保存并验证 Token：401/403 回滚配置；网络异常保留 Token 并警告
  ipcMain.handle('sync:saveToken', async (_event, token: string): Promise<SaveTokenResult> => {
    const plain = token?.trim() ?? ''
    if (plain.length === 0) {
      return { ok: false, error: '请输入 Token' }
    }
    const encrypted = encryptToken(plain)
    if (!encrypted) {
      return { ok: false, error: '当前系统不支持加密存储，无法安全保存 Token' }
    }

    const previous = await loadConfig()
    await saveConfig({ ...previous, encryptedToken: encrypted })

    try {
      await ghFetch(plain, '/gists?per_page=1')
      return { ok: true }
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('Token 无效')) {
        // Token 本身有问题：回滚，不保留无效配置
        await saveConfig({ ...previous, encryptedToken: undefined })
        return { ok: false, error: message }
      }
      // 网络问题：Token 先留着，提醒用户
      return { ok: true, warning: 'Token 已保存，但暂时无法连接 GitHub 验证，请检查网络' }
    }
  })

  // 拉取：返回云端 payload（无 Gist 时为 null，由渲染层提示先上传）
  ipcMain.handle('sync:pull', async (): Promise<PullResult> => {
    const token = await resolveToken()
    if (!token) {
      return { ok: false, error: '尚未配置 Token，请在设置中保存' }
    }

    const config = await loadConfig()
    let gistId = config.gistId
    if (!gistId) {
      const found = await findOrCreateGist(token, { create: false })
      if (!found) {
        return { ok: true, payload: null }
      }
      gistId = found.id
      await saveConfig({ ...config, gistId })
    }

    const content = await readSyncFile(token, gistId)
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return { ok: false, error: '云端数据格式无效，可能已损坏' }
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as SyncPayload).words)) {
      return { ok: false, error: '云端数据格式无效，可能已损坏' }
    }
    return { ok: true, payload: parsed as SyncPayload }
  })

  // 上传：渲染层组装 payload，主进程只负责写 Gist
  ipcMain.handle('sync:push', async (_event, payload: SyncPayload): Promise<PushResult> => {
    const token = await resolveToken()
    if (!token) {
      return { ok: false, error: '尚未配置 Token，请在设置中保存' }
    }

    const target = await findOrCreateGist(token, { create: true })
    if (!target) {
      return { ok: false, error: '未找到同步 Gist，且创建失败' }
    }

    const content = JSON.stringify(payload, null, 2)
    await ghFetch(token, `/gists/${target.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        files: { [GIST_SYNC_FILENAME]: { content } }
      })
    })

    const config = await loadConfig()
    await saveConfig({
      ...config,
      encryptedToken: config.encryptedToken,
      gistId: target.id,
      lastSyncAt: payload.syncedAt
    })
    return { ok: true, syncedAt: payload.syncedAt, gistId: target.id, created: target.created }
  })
}

export { registerSyncIpc }
