import { ref, watch, type Ref } from 'vue'

/**
 * 持久化的 ref：写入即同步到 localStorage。
 * 首次读取时若 localStorage 中已有数据，则优先使用本地数据。
 */
export function usePersistedRef<T>(key: string, initial: T): Ref<T> {
  let initialValue = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      initialValue = JSON.parse(raw) as T
    }
  } catch {
    // 数据损坏时回退到默认值
  }

  const value = ref(initialValue) as Ref<T>

  watch(
    value,
    (next) => {
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // 超出配额等场景静默失败
      }
    },
    { deep: true }
  )

  return value
}
