import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '@shared/electron-api'

const api: ElectronAPI = {
  platform: process.platform,
  openJsonFile: () => ipcRenderer.invoke('dialog:openJson'),
  saveJsonFile: (defaultName, content) =>
    ipcRenderer.invoke('dialog:saveJson', { defaultName, content }),

  // 云同步：token 明文只在主进程，渲染层经 IPC 调用
  syncGetStatus: () => ipcRenderer.invoke('sync:getStatus'),
  syncSaveToken: (token) => ipcRenderer.invoke('sync:saveToken', token),
  syncPull: () => ipcRenderer.invoke('sync:pull'),
  syncPush: (payload) => ipcRenderer.invoke('sync:push', payload)
}

contextBridge.exposeInMainWorld('electronAPI', api)
