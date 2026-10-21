<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useVocabStore } from '@/stores/vocab'
import { useUiStore } from '@/stores/ui'
import { useSpeech } from '@/composables/useSpeech'
import WordCard from '@/components/WordCard.vue'
import WordListPanel from '@/components/WordListPanel.vue'

const store = useVocabStore()
const ui = useUiStore()
const { currentWord, flipped, deck, currentIndex, settings } = storeToRefs(store)
const { speaking, speak } = useSpeech()

const position = computed(() => ({
  index: Math.max(currentIndex.value, 0),
  total: deck.value.length
}))

/** 输入框聚焦时不响应全局快捷键 */
function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * 全键盘操作：
 * Space / Enter 翻转卡片；1 / 2 / 3 评级并切下一张；← / → 切换上下张
 */
function onKeydown(event: KeyboardEvent): void {
  if (ui.anyModalOpen || isTypingTarget(event)) return

  switch (event.key) {
    case ' ':
    case 'Enter':
      event.preventDefault()
      store.toggleFlip()
      break
    case '1':
      store.rate('unknown')
      break
    case '2':
      store.rate('fuzzy')
      break
    case '3':
      store.rate('known')
      break
    case 'ArrowLeft':
      event.preventDefault()
      store.prev()
      break
    case 'ArrowRight':
      event.preventDefault()
      store.next()
      break
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <!-- 侧边栏：搜索 / 筛选 / 统计 / 列表 -->
    <WordListPanel />

    <!-- 主区域：单词卡片 -->
    <main class="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-6">
      <div class="mb-4 flex w-full max-w-[760px] items-center justify-between text-xs text-ink-faint">
        <span class="font-mono">第 {{ position.index + 1 }} / {{ position.total }} 张</span>
        <span>{{ settings.order === 'random' ? '随机乱序' : '顺序播放' }}</span>
      </div>

      <WordCard
        class="max-w-[760px]"
        :word="currentWord"
        :flipped="flipped"
        :index="position.index"
        :total="position.total"
        :speaking="speaking"
        @update:flipped="store.setFlip"
        @rate="store.rate"
        @prev="store.prev"
        @next="store.next"
        @speak="speak"
      />

      <p class="mt-5 text-center text-xs text-ink-faint">
        快捷键：<span class="text-ink-muted">空格</span> 翻转 ·
        <span class="text-ink-muted">1 / 2 / 3</span> 评级并下一张 ·
        <span class="text-ink-muted">← / →</span> 切换单词
      </p>
    </main>
  </div>
</template>
