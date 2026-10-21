import type { SyncPayload } from '@shared/sync-types'
import type { VocabSettings, WordEntry } from '@shared/word-types'

/** 词级合并统计 */
export interface MergeStats {
  /** 云端独有的新词数量 */
  added: number
  /** 云端版本较新、被更新的词数量 */
  updated: number
  /** 与 added 恒等（云端独有词 = 本地新增词），保留双字段便于扩展 */
  remoteOnly: number
}

const DEFAULT_SETTINGS: VocabSettings = {
  order: 'sequential',
  showAnswerByDefault: false
}

/** 合并 key：单词小写（大小写不同视为同一个词） */
function wordKey(word: string): string {
  return word.toLowerCase()
}

/**
 * 词级合并（并集语义，不删本地独有词）：
 * - 云端独有的词 → 新增
 * - 同词比较 updatedAt，严格大于者整体胜出（内容 + 进度 + id 一起替换）
 * - 平局或本地较新 → 保留本地
 *
 * 注意：本地「删除单词」不会同步（无 tombstone），他设备重拉会复活，属已知局限。
 */
export function mergeWords(
  local: readonly WordEntry[],
  remote: readonly WordEntry[]
): { merged: WordEntry[] } & MergeStats {
  const map = new Map<string, WordEntry>()
  for (const w of local) {
    map.set(wordKey(w.word), w)
  }

  let added = 0
  let updated = 0

  for (const r of remote) {
    const key = wordKey(r.word)
    const l = map.get(key)
    if (!l) {
      map.set(key, r)
      added += 1
    } else if (r.updatedAt > l.updatedAt) {
      map.set(key, r)
      updated += 1
    }
    // 平局或本地较新：保留本地
  }

  return { merged: [...map.values()], added, updated, remoteOnly: added }
}

/** 校验单个词条的必要字段，损坏字段修复为安全默认值 */
function sanitizeWord(input: unknown): WordEntry | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<WordEntry>
  if (typeof raw.word !== 'string' || raw.word.trim().length === 0) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : '',
    word: raw.word.trim(),
    pronunciation: typeof raw.pronunciation === 'string' ? raw.pronunciation : '',
    partOfSpeech: typeof raw.partOfSpeech === 'string' ? raw.partOfSpeech : '',
    coreMeaning: typeof raw.coreMeaning === 'string' ? raw.coreMeaning : '',
    example: typeof raw.example === 'string' ? raw.example : '',
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    collocations: Array.isArray(raw.collocations)
      ? raw.collocations
          .filter((c): c is { en: string; zh: string } => !!c && typeof c.en === 'string')
          .map((c) => ({ en: c.en, zh: typeof c.zh === 'string' ? c.zh : '' }))
      : [],
    extendedMeanings: Array.isArray(raw.extendedMeanings)
      ? raw.extendedMeanings.filter((m): m is string => typeof m === 'string')
      : [],
    status: raw.status === 'learning' || raw.status === 'mastered' ? raw.status : 'new',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : 0,
    lastRating:
      raw.lastRating === 'unknown' || raw.lastRating === 'fuzzy' || raw.lastRating === 'known'
        ? raw.lastRating
        : null,
    starred: raw.starred === true
  }
}

/**
 * 云端 payload 的最终类型守卫（主进程已做 JSON.parse 与结构粗检，
 * 渲染层在合并前做一次严格校验，与 ImportDialog 的宽容校验哲学一致）。
 * version 不是 1 或 words 不是数组 → 返回 null（拒绝合并并提示）。
 */
export function sanitizeSyncPayload(input: unknown): SyncPayload | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Partial<SyncPayload>
  if (raw.version !== 1) return null
  if (!Array.isArray(raw.words)) return null

  const words = raw.words
    .map(sanitizeWord)
    .filter((w): w is WordEntry => w !== null)

  const settings: VocabSettings =
    raw.settings && typeof raw.settings === 'object'
      ? {
          order: raw.settings.order === 'random' ? 'random' : 'sequential',
          showAnswerByDefault: raw.settings.showAnswerByDefault === true
        }
      : DEFAULT_SETTINGS

  return {
    version: 1,
    words,
    settings,
    syncedAt: typeof raw.syncedAt === 'number' ? raw.syncedAt : 0
  }
}
