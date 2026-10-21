import type { RawWordInput, WordEntry } from '@/types/vocabulary'
import { uid } from './text'

/** 提取词条的内容字段（导入更新时保留学习进度字段） */
export function pickContentFields(raw: RawWordInput): Pick<
  WordEntry,
  'pronunciation' | 'partOfSpeech' | 'coreMeaning' | 'example' | 'translation' | 'collocations' | 'extendedMeanings'
> {
  return {
    pronunciation: raw.pronunciation?.trim() ?? '',
    partOfSpeech: raw.partOfSpeech?.trim() ?? '',
    coreMeaning: raw.coreMeaning?.trim() ?? '',
    example: raw.example?.trim() ?? '',
    translation: raw.translation?.trim() ?? '',
    collocations: (raw.collocations ?? [])
      .map((c) => ({ en: c.en?.trim() ?? '', zh: c.zh?.trim() ?? '' }))
      .filter((c) => c.en.length > 0),
    extendedMeanings: (raw.extendedMeanings ?? []).filter((m) => m.trim().length > 0)
  }
}

/** 把原始词条规范化为完整 WordEntry（补齐 id、时间戳、学习进度） */
export function normalizeWord(raw: RawWordInput, now = Date.now()): WordEntry {
  return {
    id: uid(),
    word: raw.word.trim(),
    ...pickContentFields(raw),
    status: raw.status ?? 'new',
    createdAt: now,
    updatedAt: now,
    reviewCount: 0,
    lastRating: null,
    starred: raw.starred ?? false
  }
}
