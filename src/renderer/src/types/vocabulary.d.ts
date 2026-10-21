/*
 * vocabulary.d.ts — 单词卡片核心数据模型（兼容保留的引用入口）
 *
 * 实际定义已提升至 src/shared/word-types.ts（主进程 / 预加载 / 渲染层共享），
 * 此处仅作 re-export，渲染层原有 import 路径不变。
 */

export type {
  Rating,
  WordStatus,
  Collocation,
  WordEntry,
  RawWordInput,
  VocabSettings
} from '@shared/word-types'
