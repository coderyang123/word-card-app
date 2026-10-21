<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useVocabStore } from '@/stores/vocab'
import { useUiStore } from '@/stores/ui'
import type { WordStatus } from '@/types/vocabulary'

const store = useVocabStore()
const ui = useUiStore()
const { keyword, statusFilter, stats, filteredWords, currentId } = storeToRefs(store)

type FilterValue = 'all' | WordStatus

const filters = computed(() => [
  { value: 'all' as FilterValue, label: '全部', count: stats.value.total },
  { value: 'new' as FilterValue, label: '未学', count: stats.value.new },
  { value: 'learning' as FilterValue, label: '学习中', count: stats.value.learning },
  { value: 'mastered' as FilterValue, label: '已掌握', count: stats.value.mastered }
])

const STATUS_DOT: Record<WordStatus, string> = {
  new: 'bg-ink-faint',
  learning: 'bg-warn',
  mastered: 'bg-accent'
}

const masteredPercent = computed(() =>
  stats.value.total === 0 ? 0 : Math.round((stats.value.mastered / stats.value.total) * 100)
)
const learningPercent = computed(() =>
  stats.value.total === 0 ? 0 : Math.round((stats.value.learning / stats.value.total) * 100)
)

function onFilterClick(value: FilterValue): void {
  store.setStatusFilter(value)
}
</script>

<template>
  <aside class="flex w-[320px] shrink-0 flex-col border-r border-line bg-surface">
    <!-- 搜索 -->
    <div class="px-4 pt-4">
      <div class="relative">
        <svg
          viewBox="0 0 24 24"
          class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          :value="keyword"
          type="text"
          placeholder="搜索单词 / 含义 / 翻译 / 义项…"
          class="w-full rounded-xl border border-line bg-card py-2.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-accent/50 focus:outline-none"
          @input="store.setKeyword(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- 状态筛选 -->
    <div class="flex flex-wrap gap-2 px-4 pt-3">
      <button
        v-for="f in filters"
        :key="f.value"
        type="button"
        class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition"
        :class="
          statusFilter === f.value
            ? 'border-accent/50 bg-accent/10 text-accent'
            : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-soft'
        "
        @click="onFilterClick(f.value)"
      >
        {{ f.label }}
        <span class="font-mono text-[10px] opacity-70">{{ f.count }}</span>
      </button>
    </div>

    <!-- 统计 -->
    <div class="mx-4 mt-4 rounded-xl border border-line bg-card p-4">
      <div class="flex items-baseline justify-between">
        <span class="text-xs text-ink-faint">掌握进度</span>
        <span class="font-mono text-sm text-accent">{{ masteredPercent }}%</span>
      </div>
      <div class="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line">
        <div class="bg-accent" :style="{ width: `${masteredPercent}%` }" />
        <div class="bg-warn/70" :style="{ width: `${learningPercent}%` }" />
      </div>
      <div class="mt-2.5 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>已掌握 {{ stats.mastered }}</span>
        <span>学习中 {{ stats.learning }}</span>
        <span>未学 {{ stats.new }}</span>
      </div>
    </div>

    <!-- 生词列表 -->
    <div class="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <p class="px-2 py-1.5 text-[11px] tracking-wider text-ink-faint uppercase">
        生词列表 · {{ filteredWords.length }}
      </p>
      <div v-if="filteredWords.length === 0" class="px-3 py-8 text-center text-xs text-ink-faint">
        没有匹配的单词
      </div>
      <div
        v-for="w in filteredWords"
        :key="w.id"
        role="button"
        tabindex="0"
        class="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition"
        :class="w.id === currentId ? 'bg-card-hover ring-1 ring-line-strong' : 'hover:bg-white/[0.03]'"
        @click="store.goTo(w.id)"
        @keydown.enter.self="store.goTo(w.id)"
        @keydown.space.self.prevent="store.goTo(w.id)"
      >
        <span class="h-2 w-2 shrink-0 rounded-full" :class="STATUS_DOT[w.status]" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-ink-soft group-hover:text-ink">
            {{ w.word }}
          </span>
          <span class="block truncate text-xs text-ink-faint">{{ w.coreMeaning ?? '' }}</span>
        </span>
        <!-- 删除单词（hover 显示，降低误触） -->
        <button
          type="button"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
          title="删除单词"
          @click.stop="store.deleteWord(w.id)"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md px-1 text-xs transition"
          :class="w.starred ? 'text-accent' : 'text-transparent group-hover:text-ink-faint hover:text-ink-soft'"
          title="标星"
          @click.stop="store.toggleStar(w.id)"
        >
          ★
        </button>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="grid grid-cols-2 gap-2 border-t border-line p-4">
      <button
        type="button"
        class="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/15"
        @click="ui.showImport = true"
      >
        导入生词
      </button>
      <button
        type="button"
        class="rounded-xl border border-line px-3 py-2 text-xs text-ink-muted transition hover:border-line-strong hover:text-ink-soft"
        @click="ui.showSettings = true"
      >
        设置
      </button>
    </div>
  </aside>
</template>
