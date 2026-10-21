import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeWords,
  sanitizeSyncPayload
} from '../src/renderer/src/utils/mergeWords.ts'
import type { WordEntry } from '../src/shared/word-types.ts'

/** 构造测试用词条 */
function makeWord(overrides: Partial<WordEntry> & { word: string }): WordEntry {
  return {
    id: `id-${overrides.word}`,
    pronunciation: '/x/',
    partOfSpeech: 'noun (名词)',
    coreMeaning: '测试',
    example: `This is ${overrides.word}.`,
    translation: '这是测试。',
    collocations: [],
    extendedMeanings: [],
    status: 'new',
    createdAt: 1000,
    updatedAt: 1000,
    reviewCount: 0,
    lastRating: null,
    starred: false,
    ...overrides
  }
}

describe('mergeWords', () => {
  it('远端独有词 → added=1，合并为并集', () => {
    const local = [makeWord({ word: 'alpha' })]
    const remote = [makeWord({ word: 'beta' })]
    const { merged, added, updated } = mergeWords(local, remote)
    assert.equal(added, 1)
    assert.equal(updated, 0)
    assert.equal(merged.length, 2)
    assert.ok(merged.some((w) => w.word === 'beta'))
    assert.ok(merged.some((w) => w.word === 'alpha'))
  })

  it('同词远端 updatedAt 更大 → updated=1 且整体取远端（含 id 与进度）', () => {
    const local = [makeWord({ word: 'alpha', id: 'local-id', updatedAt: 1000, status: 'new' })]
    const remote = [
      makeWord({ word: 'alpha', id: 'remote-id', updatedAt: 2000, status: 'mastered', reviewCount: 3 })
    ]
    const { merged, updated } = mergeWords(local, remote)
    assert.equal(updated, 1)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].id, 'remote-id')
    assert.equal(merged[0].status, 'mastered')
    assert.equal(merged[0].reviewCount, 3)
  })

  it('同词本地 updatedAt 更大或平局 → 保留本地', () => {
    const local = [makeWord({ word: 'alpha', id: 'local-id', updatedAt: 5000 })]
    const remoteNewer = [makeWord({ word: 'alpha', id: 'remote-id', updatedAt: 2000 })]
    const remoteTie = [makeWord({ word: 'alpha', id: 'remote-id', updatedAt: 5000 })]
    assert.equal(mergeWords(local, remoteNewer).merged[0].id, 'local-id')
    assert.equal(mergeWords(local, remoteNewer).updated, 0)
    assert.equal(mergeWords(local, remoteTie).merged[0].id, 'local-id')
    assert.equal(mergeWords(local, remoteTie).updated, 0)
  })

  it('大小写不同的同一个词视为同词', () => {
    const local = [makeWord({ word: 'Alpha', id: 'local-id', updatedAt: 5000 })]
    const remote = [makeWord({ word: 'alpha', id: 'remote-id', updatedAt: 1000 })]
    const { merged } = mergeWords(local, remote)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].id, 'local-id')
  })

  it('空远端 / 空本地不丢数据', () => {
    const local = [makeWord({ word: 'alpha' })]
    assert.equal(mergeWords(local, []).merged.length, 1)
    assert.equal(mergeWords([], local).merged.length, 1)
    assert.equal(mergeWords([], []).merged.length, 0)
  })
})

describe('sanitizeSyncPayload', () => {
  const validPayload = {
    version: 1,
    words: [makeWord({ word: 'alpha' })],
    settings: { order: 'random', showAnswerByDefault: true },
    syncedAt: 12345
  }

  it('合法 payload 原样通过', () => {
    const result = sanitizeSyncPayload(validPayload)
    assert.ok(result)
    assert.equal(result.version, 1)
    assert.equal(result.words.length, 1)
    assert.equal(result.settings.order, 'random')
    assert.equal(result.syncedAt, 12345)
  })

  it('version 不是 1 → 拒绝', () => {
    assert.equal(sanitizeSyncPayload({ ...validPayload, version: 2 }), null)
    assert.equal(sanitizeSyncPayload({ ...validPayload, version: undefined }), null)
  })

  it('words 不是数组 → 拒绝', () => {
    assert.equal(sanitizeSyncPayload({ ...validPayload, words: 'nope' }), null)
    assert.equal(sanitizeSyncPayload({ ...validPayload, words: undefined }), null)
  })

  it('缺 word 字段的条目被丢弃，其余保留', () => {
    const result = sanitizeSyncPayload({
      ...validPayload,
      words: [makeWord({ word: 'alpha' }), { pronunciation: '/x/' }, null]
    })
    assert.ok(result)
    assert.equal(result.words.length, 1)
    assert.equal(result.words[0].word, 'alpha')
  })

  it('损坏字段修复为安全默认值（status/updatedAt/collocations）', () => {
    const result = sanitizeSyncPayload({
      ...validPayload,
      words: [
        {
          word: 'alpha',
          status: 'bogus',
          updatedAt: 'not-a-number',
          collocations: [{ en: 'ok' }, 'garbage', null],
          extendedMeanings: ['good', 42]
        }
      ]
    })
    assert.ok(result)
    const w = result.words[0]
    assert.equal(w.status, 'new')
    assert.equal(w.updatedAt, 0)
    assert.deepEqual(w.collocations, [{ en: 'ok', zh: '' }])
    assert.deepEqual(w.extendedMeanings, ['good'])
  })

  it('settings 缺失 → 回落默认值', () => {
    const result = sanitizeSyncPayload({ version: 1, words: [], syncedAt: 0 })
    assert.ok(result)
    assert.deepEqual(result.settings, { order: 'sequential', showAnswerByDefault: false })
  })
})
