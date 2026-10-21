/** 生成简短唯一 id */
export function uid(prefix = 'w'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** HTML 转义，防止词库内容注入 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 正则特殊字符转义 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 在例句中高亮目标单词（兼容 s / es / ed / ing 等常见词形变化）。
 * 返回经过 HTML 转义的安全字符串，可直接用于 v-html。
 */
export function highlightWord(text: string, word: string): string {
  const escaped = escapeHtml(text)
  const target = escapeRegExp(word.trim())
  if (!target) return escaped
  const pattern = new RegExp(`\\b(${target}(?:s|es|ed|ing)?)\\b`, 'gi')
  return escaped.replace(pattern, '<mark class="hl-word">$1</mark>')
}
