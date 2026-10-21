<script setup lang="ts">
// 顶部拖拽区：原生最小化 / 最大化 / 关闭按钮由系统绘制在右上角，右侧预留空间
</script>

<template>
  <header
    class="drag-region flex h-10 w-full shrink-0 items-center justify-between border-b border-line/60 bg-base px-4"
  >
    <div class="pointer-events-none flex items-center gap-2.5">
      <span class="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-accent">
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="currentColor">
          <path d="M4 4h6.5a2 2 0 0 1 2 2v14a2.5 2.5 0 0 0-2.5-2.5H4V4z" opacity="0.55" />
          <path d="M20 4h-6.5a2 2 0 0 0-2 2v14a2.5 2.5 0 0 1 2.5-2.5H20V4z" />
        </svg>
      </span>
      <span class="text-xs font-semibold tracking-wide text-ink-soft">WordCard</span>
      <span class="text-[11px] text-ink-faint">技术阅读单词卡</span>
    </div>
    <!-- 预留系统窗口控制按钮区域 -->
    <div class="h-10 w-[140px]" />
  </header>
</template>
