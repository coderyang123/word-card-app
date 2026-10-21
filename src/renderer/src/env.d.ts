/// <reference types="vite/client" />

import type { ElectronAPI } from '@shared/electron-api'

declare global {
  interface Window {
    /** 由 preload 通过 contextBridge 注入，仅在 Electron 环境可用 */
    electronAPI?: ElectronAPI
  }
}

export {}
