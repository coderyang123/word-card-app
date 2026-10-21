<script setup lang="ts">
import { computed } from 'vue'
import type { Rating, WordEntry, WordStatus } from '@/types/vocabulary'
import { highlightWord } from '@/utils/text'

const props = defineProps<{
  /** 当前单词，null 表示词库为空 */
  word: WordEntry | null
  /** 是否已翻转（展开答案） */
  flipped: boolean
  /** 当前是牌组中第几张（从 0 开始） */
  index: number
  /** 牌组总数 */
  total: number
  /** 是否正在朗读（用于发音图标动效） */
  speaking?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:flipped', value: boolean): void
  (e: 'rate', rating: Rating): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'speak', text: string): void
}>()

const STATUS_META: Record<WordStatus, { label: string; className: string }> = {
  new: { label: '未学', className: 'border-line-strong bg-white/5 text-ink-muted' },
  learning: { label: '学习中', className: 'border-warn/40 bg-warn/10 text-warn' },
  mastered: { label: '已掌握', className: 'border-accent/40 bg-accent/10 text-accent' }
}

const statusMeta = computed(() => (props.word ? STATUS_META[props.word.status] : STATUS_META.new))
const highlightedExample = computed(() =>
  props.word ? highlightWord(props.word.example, props.word.word) : ''
)

/** 头部副标题行：发音 · 词性（全空时不渲染） */
const subtitle = computed(() =>
  [props.word?.pronunciation, props.word?.partOfSpeech].filter(Boolean).join(' · ')
)

/** 长单词自适应缩小字号，保证任何词都完整舒展地展示 */
const wordSizeClass = computed(() => {
  const len = props.word?.word.length ?? 0
  if (len >= 14) return 'text-[30px]'
  if (len >= 10) return 'text-[34px]'
  return 'text-[40px]'
})

const RATING_BUTTONS: { rating: Rating; label: string; hint: string; className: string }[] = [
  {
    rating: 'unknown',
    label: '不认识',
    hint: '1',
    className: 'border-danger/40 text-danger hover:border-danger/70 hover:bg-danger/10'
  },
  {
    rating: 'fuzzy',
    label: '模糊',
    hint: '2',
    className: 'border-warn/40 text-warn hover:border-warn/70 hover:bg-warn/10'
  },
  {
    rating: 'known',
    label: '认识',
    hint: '3',
    className: 'border-accent/50 text-accent hover:border-accent hover:bg-accent/15'
  }
]

function toggleFlip(): void {
  emit('update:flipped', !props.flipped)
}

/** 点击卡片空白处翻转；点击交互元素不触发 */
function onCardClick(event: MouseEvent): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a, input, textarea, select')) return
  toggleFlip()
}
</script>

<template>
  <!-- 空状态：词库为空 -->
  <section
    v-if="!word"
    class="flex min-h-[420px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card/60 p-10 text-center"
  >
    <p class="text-sm text-ink-muted">牌组中暂无单词</p>
    <p class="mt-1 text-xs text-ink-faint">通过左侧「导入生词」扩充词库</p>
  </section>

  <!-- 单词卡片 -->
  <section
    v-else
    class="flex min-h-[540px] w-full cursor-pointer flex-col rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40"
    @click="onCardClick"
  >
    <!-- 顶部区域：单词 + 发音 + 副标题 + 状态标签 -->
    <header class="flex items-start justify-between gap-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 pb-1">
          <h1
            class="font-bold tracking-tight text-ink"
            :class="[wordSizeClass, 'leading-[1.2]']"
          >
            {{ word.word }}
          </h1>
          <button
            type="button"
            class="no-drag flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition hover:border-accent/50 hover:text-accent"
            :class="speaking ? 'border-accent/60 text-accent' : ''"
            title="朗读单词"
            @click.stop="emit('speak', word.word)"
          >
            <svg
              v-if="!speaking"
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4.5v15L6.8 17H3.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3.3L11 4.5z" />
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              class="h-4 w-4 animate-pulse"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4.5v15L6.8 17H3.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3.3L11 4.5z" />
              <path d="M15.5 9a4 4 0 0 1 0 6" />
              <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
            </svg>
          </button>
        </div>
        <!-- 副标题：发音 · 词性 -->
        <p v-if="subtitle" class="mt-1 font-mono text-sm text-ink-muted">{{ subtitle }}</p>
      </div>

      <!-- 右上角状态标签 -->
      <span
        class="shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
        :class="statusMeta.className"
      >
        {{ statusMeta.label }}
      </span>
    </header>

    <!-- 主体内容：未翻转只显示例句，翻转后展示完整释义 -->
    <div class="mt-7 flex-1">
      <Transition name="fade-up" mode="out-in">
        <!-- 卡片正面 -->
        <div v-if="!flipped" key="front" class="space-y-6">
          <p class="text-sm text-ink-faint">先回忆核心含义 · 按 空格 或 点击卡片 翻转</p>
          <blockquote
            class="border-l-2 border-accent/60 pl-4 text-lg leading-relaxed text-ink-soft"
            v-html="highlightedExample"
          />
          <p class="text-xs text-ink-faint">例句中的目标词已高亮</p>
        </div>

        <!-- 卡片背面 -->
        <div v-else key="back" class="space-y-6">
          <!-- 核心含义 -->
          <div v-if="word.coreMeaning">
            <h3 class="section-label">核心含义</h3>
            <p class="mt-2 text-xl font-semibold text-ink">{{ word.coreMeaning }}</p>
          </div>

          <!-- 原始语境（例句） -->
          <div v-if="word.example">
            <h3 class="section-label">原始语境</h3>
            <p class="mt-2 text-lg leading-relaxed text-ink-soft" v-html="highlightedExample" />
          </div>

          <!-- 我的理解（例句翻译） -->
          <div v-if="word.translation">
            <h3 class="section-label">我的理解</h3>
            <p class="mt-2 text-[15px] leading-relaxed text-ink-muted">{{ word.translation }}</p>
          </div>

          <!-- 常见搭配 -->
          <div v-if="word.collocations.length > 0">
            <h3 class="section-label">常见搭配</h3>
            <ul class="mt-2 space-y-1.5">
              <li
                v-for="c in word.collocations"
                :key="c.en"
                class="flex items-baseline gap-2.5 text-[15px]"
              >
                <span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span class="font-medium text-ink-soft">{{ c.en }}</span>
                <span class="text-ink-faint">—</span>
                <span class="text-ink-muted">{{ c.zh }}</span>
              </li>
            </ul>
          </div>

          <!-- 其他义项 -->
          <div v-if="word.extendedMeanings.length > 0">
            <h3 class="section-label">其他义项</h3>
            <ul class="mt-2 space-y-1.5">
              <li
                v-for="(m, i) in word.extendedMeanings"
                :key="i"
                class="flex items-baseline gap-2.5 text-[15px] text-ink-muted"
              >
                <span class="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
                <span>{{ m }}</span>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 底部操作栏：翻页 + 记忆评级 -->
    <footer class="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-30"
          title="上一张（←）"
          :disabled="total <= 1"
          @click.stop="emit('prev')"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span class="font-mono text-xs text-ink-faint">{{ index + 1 }} / {{ total }}</span>
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-30"
          title="下一张（→）"
          :disabled="total <= 1"
          @click.stop="emit('next')"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button
          v-for="btn in RATING_BUTTONS"
          :key="btn.rating"
          type="button"
          class="flex items-center gap-2 rounded-xl border bg-white/[0.02] px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]"
          :class="btn.className"
          @click.stop="emit('rate', btn.rating)"
        >
          {{ btn.label }}
          <kbd class="rounded border border-line-strong bg-base px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
            {{ btn.hint }}
          </kbd>
        </button>
      </div>
    </footer>
  </section>
</template>
