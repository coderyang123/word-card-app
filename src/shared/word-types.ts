/*
 * word-types.ts — 单词卡片核心数据模型（主进程 / 预加载 / 渲染层共享）
 *
 * 字段命名与用户导入的 vocabulary.json 完全一致：
 * word / pronunciation / partOfSpeech / coreMeaning / example / translation / collocations / extendedMeanings
 *
 * 提升到 shared 的原因：云同步的 SyncPayload 需要主进程（IPC 契约）与渲染层
 * 共用同一份类型定义；原渲染层路径 @/types/vocabulary 保留为 re-export。
 */

/** 记忆评级（底部操作栏三档） */
export type Rating = 'unknown' | 'fuzzy' | 'known'

/** 学习状态 */
export type WordStatus = 'new' | 'learning' | 'mastered'

/** 补充搭配条目 */
export interface Collocation {
  /** 英文搭配 */
  en: string
  /** 中文释义 */
  zh: string
}

/** 规范化后的单词条目（含学习进度） */
export interface WordEntry {
  /** 唯一 id */
  id: string
  /** 单词本身，如 "absolute" */
  word: string
  /** 音标，如 "/ˈæbsəljuːt/" */
  pronunciation: string
  /** 词性，如 "adjective (形容词)" */
  partOfSpeech: string
  /** 核心含义（阅读向精简释义，字符串原样展示，如 "绝对的，完全的"） */
  coreMeaning: string
  /** 英文例句（目标词会在 UI 中高亮） */
  example: string
  /** 例句的中文翻译 */
  translation: string
  /** 补充搭配列表 */
  collocations: Collocation[]
  /** 其他义项 */
  extendedMeanings: string[]
  /** 学习状态 */
  status: WordStatus
  /** 创建时间（epoch ms） */
  createdAt: number
  /** 最近更新时间（epoch ms）——云同步按此字段做词级合并 */
  updatedAt: number
  /** 复习次数 */
  reviewCount: number
  /** 最近一次评级 */
  lastRating: Rating | null
  /** 是否标星 */
  starred: boolean
}

/** 导入词库的原始词条形状（与 vocabulary.json 一致，除 word 外均可选） */
export interface RawWordInput {
  word: string
  pronunciation?: string
  partOfSpeech?: string
  coreMeaning?: string
  example?: string
  translation?: string
  collocations?: Collocation[]
  extendedMeanings?: string[]
  status?: WordStatus
  starred?: boolean
}

/** 应用设置（随云同步） */
export interface VocabSettings {
  /** 播放顺序：顺序 / 随机 */
  order: 'sequential' | 'random'
  /** 进入卡片时是否默认展开答案 */
  showAnswerByDefault: boolean
}
