import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Rating, RawWordInput, VocabSettings, WordEntry, WordStatus } from '@/types/vocabulary'
import { usePersistedRef } from '@/composables/usePersist'
import { normalizeWord, pickContentFields } from '@/utils/word'
import { mergeWords, type MergeStats } from '@/utils/mergeWords'

export type { VocabSettings }

export const WORDS_STORAGE_KEY = 'wordcard:words:v1'
export const SETTINGS_STORAGE_KEY = 'wordcard:settings:v1'
/** 一次性迁移标记：清理早期版本内置的示例词 */
const BUILTIN_REMOVED_FLAG = 'wordcard:builtin-sample-removed'

/** 早期版本内置的 20 个示例词（仅用于一次性迁移清理，不再作为词库装载） */
const BUILTIN_SAMPLE_WORDS: ReadonlySet<string> = new Set([
  'algorithm', 'asymptotic', 'refactor', 'idempotent', 'concurrency',
  'immutable', 'throughput', 'latency', 'scalability', 'heuristic',
  'deterministic', 'decouple', 'overhead', 'abstraction', 'invariant',
  'serialization', 'orchestration', 'observability', 'semantics', 'redundancy'
])

/** 评级 → 学习状态映射 */
export const RATING_TO_STATUS: Record<Rating, WordStatus> = {
  unknown: 'new',
  fuzzy: 'learning',
  known: 'mastered'
}

export const useVocabStore = defineStore('vocab', () => {
  // ---------- 持久化状态 ----------
  const words = usePersistedRef<WordEntry[]>(WORDS_STORAGE_KEY, [])
  const settings = usePersistedRef<VocabSettings>(SETTINGS_STORAGE_KEY, {
    order: 'sequential',
    showAnswerByDefault: false
  })

  // 一次性迁移：移除早期版本自动装载的内置示例词，仅保留用户导入的词库
  if (!localStorage.getItem(BUILTIN_REMOVED_FLAG)) {
    try {
      words.value = words.value.filter(
        (w) => !BUILTIN_SAMPLE_WORDS.has(w.word.toLowerCase())
      )
      localStorage.setItem(BUILTIN_REMOVED_FLAG, '1')
    } catch {
      // 存储不可用时跳过，不影响使用
    }
  }

  // ---------- 会话状态（不持久化） ----------
  const keyword = ref('')
  const statusFilter = ref<'all' | WordStatus>('all')
  const shuffleSeed = ref(Math.floor(Math.random() * 1_000_000))
  const currentId = ref<string | null>(null)
  const flipped = ref(settings.value.showAnswerByDefault)

  // 切换顺序时重新洗牌
  watch(
    () => settings.value.order,
    () => {
      shuffleSeed.value = Math.floor(Math.random() * 1_000_000)
    }
  )

  // ---------- 派生 ----------
  const filteredWords = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    return words.value.filter((w) => {
      if (statusFilter.value !== 'all' && w.status !== statusFilter.value) return false
      if (kw.length === 0) return true
      return (
        w.word.toLowerCase().includes(kw) ||
        (w.coreMeaning ?? '').toLowerCase().includes(kw) ||
        (w.translation ?? '').toLowerCase().includes(kw) ||
        (w.extendedMeanings ?? []).some((m) => m.toLowerCase().includes(kw))
      )
    })
  })

  /** 当前牌组：遵循筛选结果与播放顺序 */
  const deck = computed(() => {
    const list = filteredWords.value
    if (settings.value.order === 'sequential') return list

    const arr = [...list]
    let seed = shuffleSeed.value
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
    }
    return arr
  })

  const stats = computed(() => {
    const result = { total: words.value.length, new: 0, learning: 0, mastered: 0 }
    for (const w of words.value) {
      result[w.status] += 1
    }
    return result
  })

  const currentIndex = computed(() => {
    if (deck.value.length === 0) return -1
    const idx = deck.value.findIndex((w) => w.id === currentId.value)
    return idx >= 0 ? idx : 0
  })

  const currentWord = computed(() =>
    currentIndex.value >= 0 ? deck.value[currentIndex.value]! : null
  )

  // ---------- 动作 ----------
  function move(delta: number): void {
    const list = deck.value
    if (list.length === 0) return
    const idx = list.findIndex((w) => w.id === currentId.value)
    const from = idx >= 0 ? idx : 0
    const to = (from + delta + list.length) % list.length
    currentId.value = list[to]!.id
    flipped.value = settings.value.showAnswerByDefault
  }

  function next(): void {
    move(1)
  }

  function prev(): void {
    move(-1)
  }

  function goTo(id: string): void {
    if (!deck.value.some((w) => w.id === id)) return
    currentId.value = id
    flipped.value = settings.value.showAnswerByDefault
  }

  function toggleFlip(): void {
    flipped.value = !flipped.value
  }

  function setFlip(value: boolean): void {
    flipped.value = value
  }

  /** 评级并自动切到下一张 */
  function rate(rating: Rating): void {
    const word = currentWord.value
    if (!word) return
    const now = Date.now()
    word.status = RATING_TO_STATUS[rating]
    word.lastRating = rating
    word.reviewCount += 1
    word.updatedAt = now
    move(1)
  }

  function toggleStar(id: string): void {
    const word = words.value.find((w) => w.id === id)
    if (!word) return
    word.starred = !word.starred
    word.updatedAt = Date.now()
  }

  /** 删除单个单词；若删除的是当前卡片，currentId 置空（自动落到牌组首张） */
  function deleteWord(id: string): void {
    words.value = words.value.filter((w) => w.id !== id)
    if (currentId.value === id) {
      currentId.value = null
    }
  }

  /** 清空词库（全部单词） */
  function clearAll(): void {
    words.value = []
    currentId.value = null
    flipped.value = settings.value.showAnswerByDefault
  }

  /**
   * 应用云端合并结果：词级合并后整表替换（deep watch 自动落盘）。
   * 返回合并统计供 toast 展示。
   */
  function applySyncedWords(remote: readonly WordEntry[]): MergeStats {
    const { merged, ...stats } = mergeWords(words.value, remote)
    words.value = merged
    // currentId 指向的词可能已被整体替换（id 变化）→ 失效则置空（落到牌组首张）
    if (currentId.value && !merged.some((w) => w.id === currentId.value)) {
      currentId.value = null
    }
    return stats
  }

  /** 设置：远端整体覆盖本地（LWW） */
  function applySyncedSettings(next: VocabSettings): void {
    Object.assign(settings.value, next)
  }

  function setKeyword(value: string): void {
    keyword.value = value
    flipped.value = settings.value.showAnswerByDefault
  }

  function setStatusFilter(value: 'all' | WordStatus): void {
    statusFilter.value = value
    flipped.value = settings.value.showAnswerByDefault
  }

  function updateSettings(patch: Partial<VocabSettings>): void {
    Object.assign(settings.value, patch)
  }

  /**
   * 导入生词：按 word 去重合并。
   * 已存在的词条只更新内容字段，保留学习进度。
   */
  function importWords(input: readonly RawWordInput[]): { added: number; updated: number } {
    const map = new Map(words.value.map((w) => [w.word.toLowerCase(), w]))
    let added = 0
    let updated = 0
    const now = Date.now()

    for (const raw of input) {
      const key = raw.word?.trim().toLowerCase()
      if (!key) continue
      const existing = map.get(key)
      if (existing) {
        Object.assign(existing, pickContentFields(raw), { updatedAt: now })
        updated += 1
      } else {
        map.set(key, normalizeWord(raw, now))
        added += 1
      }
    }

    words.value = [...map.values()]
    return { added, updated }
  }

  /** 导出词库 JSON（含学习进度） */
  function exportWords(): string {
    return JSON.stringify(words.value, null, 2)
  }

  /** 重置学习进度：状态回到「未学」，复习次数清零，词库内容保留 */
  function resetProgress(): void {
    const now = Date.now()
    words.value = words.value.map((w) => ({
      ...w,
      status: 'new',
      reviewCount: 0,
      lastRating: null,
      updatedAt: now
    }))
    currentId.value = null
    flipped.value = settings.value.showAnswerByDefault
  }

  return {
    // state
    words,
    settings,
    keyword,
    statusFilter,
    currentId,
    flipped,
    // getters
    filteredWords,
    deck,
    stats,
    currentIndex,
    currentWord,
    // actions
    next,
    prev,
    goTo,
    toggleFlip,
    setFlip,
    rate,
    toggleStar,
    deleteWord,
    clearAll,
    applySyncedWords,
    applySyncedSettings,
    setKeyword,
    setStatusFilter,
    updateSettings,
    importWords,
    exportWords,
    resetProgress
  }
})
