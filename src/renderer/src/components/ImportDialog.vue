<script setup lang="ts">
import { ref } from 'vue'
import { useVocabStore } from '@/stores/vocab'
import { useUiStore } from '@/stores/ui'
import BaseModal from './BaseModal.vue'
import type { RawWordInput } from '@/types/vocabulary'

const store = useVocabStore()
const ui = useUiStore()

const text = ref('')
const error = ref('')
const preview = ref<{ count: number; sample: string[] } | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

/** 解析并校验导入内容，成功时返回有效词条 */
function parse(): RawWordInput[] | null {
  error.value = ''
  preview.value = null

  const trimmed = text.value.trim()
  if (trimmed.length === 0) {
    error.value = '请粘贴 JSON 内容，或点击「选择文件」'
    return null
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch (err) {
    error.value = `JSON 解析失败：${(err as Error).message}`
    return null
  }

  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { words?: unknown }).words)
      ? (data as { words: unknown[] }).words
      : null

  if (!arr) {
    error.value = 'JSON 需要是数组，或形如 { "words": [...] } 的对象'
    return null
  }

  const valid = arr.filter((item): item is RawWordInput => {
    if (!item || typeof item !== 'object') return false
    const word = (item as { word?: unknown }).word
    return typeof word === 'string' && word.trim().length > 0
  })

  if (valid.length === 0) {
    error.value = '未找到有效词条：每项至少需要字符串字段 word'
    return null
  }

  preview.value = {
    count: valid.length,
    sample: valid.slice(0, 5).map((w) => w.word.trim())
  }
  return valid
}

function validate(): void {
  parse()
}

/** 优先走 Electron 原生文件选择器，浏览器环境回退到 <input type="file"> */
async function chooseFile(): Promise<void> {
  if (window.electronAPI) {
    const result = await window.electronAPI.openJsonFile()
    if (result.ok && result.content) {
      text.value = result.content
      validate()
    }
    return
  }
  fileInput.value?.click()
}

function onFilePicked(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    text.value = String(reader.result ?? '')
    validate()
  }
  reader.readAsText(file)
  input.value = ''
}

function confirmImport(): void {
  const entries = parse()
  if (!entries) return
  const { added, updated } = store.importWords(entries)
  ui.notify(`导入完成：新增 ${added} 词，更新 ${updated} 词`)
  close()
}

function close(): void {
  ui.showImport = false
  text.value = ''
  error.value = ''
  preview.value = null
}
</script>

<template>
  <BaseModal
    :open="ui.showImport"
    title="导入生词"
    description="支持 JSON 数组，按单词自动去重合并，已掌握进度不受影响"
    @close="close"
  >
    <textarea
      v-model="text"
      rows="9"
      spellcheck="false"
      placeholder='[{"word": "immutable", "pronunciation": "/ɪˈmjuːtəbl/", "partOfSpeech": "adjective (形容词)", "coreMeaning": "不可变的", "example": "Immutable data structures make state changes easy to trace.", "translation": "不可变数据结构让状态变更易于追踪。", "collocations": [{"en": "immutable object", "zh": "不可变对象"}], "extendedMeanings": ["不可改变的"]}]'
      class="w-full resize-none rounded-xl border border-line bg-base p-3 font-mono text-xs leading-relaxed text-ink-soft placeholder:text-ink-faint focus:border-accent/50 focus:outline-none"
      @input="validate"
    />

    <div class="mt-3 flex items-center gap-3">
      <button
        type="button"
        class="rounded-xl border border-line px-3 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft"
        @click="chooseFile"
      >
        选择文件…
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="onFilePicked"
      />
      <span class="text-xs text-ink-faint">或直接粘贴 JSON 文本</span>
    </div>

    <p v-if="error" class="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
      {{ error }}
    </p>
    <div v-else-if="preview" class="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-ink-soft">
      校验通过：共 {{ preview.count }} 个词条，示例：
      <span class="font-mono text-accent">{{ preview.sample.join('、') }}</span>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-line px-4 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft"
        @click="close"
      >
        取消
      </button>
      <button
        type="button"
        class="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/15"
        @click="confirmImport"
      >
        确认导入
      </button>
    </template>
  </BaseModal>
</template>
