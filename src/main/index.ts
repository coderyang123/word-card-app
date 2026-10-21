import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { registerSyncIpc } from './sync'

/** 应用品牌色，与渲染层 Tailwind 主题保持一致（避免窗口出现白底闪烁） */
const BRAND_BG = '#0d0d0d'

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: BRAND_BG,
    // Windows 上隐藏原生标题栏，仅保留右上角系统窗口按钮（绘制在 overlay 区域内）
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: BRAND_BG,
      height: 40,
      symbolColor: '#a0a0a0'
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 新窗口一律交给系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

function registerIpc(): void {
  // 选择本地 JSON 文件（生词导入）
  ipcMain.handle('dialog:openJson', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择生词 JSON 文件',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'cancelled' }
    }
    const filePath = result.filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    return { ok: true, content, fileName: filePath }
  })

  // 保存 JSON 文件（生词导出）
  ipcMain.handle(
    'dialog:saveJson',
    async (_event, payload: { defaultName: string; content: string }) => {
      const result = await dialog.showSaveDialog({
        title: '导出生词库',
        defaultPath: payload.defaultName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, error: 'cancelled' }
      }
      await writeFile(result.filePath, payload.content, 'utf-8')
      return { ok: true, filePath: result.filePath }
    }
  )

  // 云同步（GitHub 私有 Gist）
  registerSyncIpc()
}

Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  registerIpc()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
