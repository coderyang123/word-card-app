# WordCard · 技术阅读单词卡

一款专为 **技术阅读**打造的极简暗黑风 Windows 桌面端单词卡片记忆软件。

技术栈： **Electron 44 + Vue 3.5 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Pinia 4**

## 快速开始

包管理器使用 **pnpm**（依赖经 pnpm 全局 store 硬链接共享，多个项目不重复占磁盘）。

```bash
# 安装依赖（需要 pnpm 10+；首次安装会自动下载 Electron 二进制，约 370MB）
pnpm install

# 开发模式（热更新）
pnpm dev

# 类型检查 / 单测 / 构建
pnpm typecheck
pnpm test
pnpm run build

# 打包 Windows 安装包（NSIS，输出到 release/）
pnpm dist
```

**关于 Electron 二进制**：Electron 42+ 出于供应链安全考虑移除了 postinstall，二进制改为 **首次运行 `pnpm dev` 时惰性下载**
（已配置 npmmirror 镜像加速）。如需手动安装：`pnpm install:electron`。

## 功能特性

### 卡片复习

- **翻卡记忆模式**：默认只展示单词、音标与例句，按 `空格` / `Enter` 或点击卡片后展开核心含义、理解说明与补充搭配；可在设置中改为默认全显
- **全键盘操作**：
    - `空格` / `Enter`：翻转卡片
    - `1` / `2` / `3`：评级（不认识 / 模糊 / 认识）并自动切到下一张
    - `←` / `→`：切换上一个 / 下一个单词
- **顺序 / 随机乱序**两种播放顺序，随机模式在切换时重新洗牌
- 点击发音图标调用系统 Speech API 朗读单词（Windows TTS）
- 例句中的目标词（含常见词形变化）自动高亮

### 数据导入与持久化

- 词库完全由用户导入构成（无内置词），首次启动为空词库，等待导入
- 学习进度实时持久化到 `localStorage`（key：`wordcard:words:v1`），设置项持久化到 `wordcard:settings:v1`
- **导入生词**：支持粘贴 JSON 或通过系统文件选择器读取，按单词去重合并（已掌握进度不受影响）
- **导出生词库**：通过系统保存对话框导出完整 JSON（含学习进度）
- **删除单词**：列表项 hover 显示 × 即时删除；设置中可「清空词库」（二次确认）
- **重置学习进度**：状态回到「未学」，词库内容保留

### 云同步（GitHub 私有 Gist）

- 多设备同步 **词库 + 学习进度 + 设置**到你的 GitHub 私有 Gist（单文件 `wordcard.json`）
- **启动时自动拉取合并**，上传手动触发（设置 → 云同步 → 立即上传）
- 首次上传自动创建私有 Gist；其他设备填入同一 Token 自动发现并绑定，无需手动复制 ID
- Token 经本机系统加密（Windows DPAPI / macOS Keychain）后存放，明文不落盘、不进渲染层
- 合并策略： **词级合并**——按 `updatedAt` 取较新版本，并集语义不丢数据；设置为整体覆盖
- 已知局限：删除单词的操作不会同步（其他设备重拉会复活）；同步依赖本机时钟

### 统计与列表管理

- 侧边栏生词列表：关键字搜索（单词 / 含义 / 翻译 / 义项）、按状态（未学 / 学习中 / 已掌握）快速筛选、标星
- 掌握进度条：已掌握 / 学习中 / 未学占比一目了然
- 点击列表项直接跳转对应卡片；筛选结果即时作用于当前牌组

## 云同步配置步骤

1. 打开 <https://github.com/settings/tokens?type=beta> → **Generate new token**
2. 权限勾选 **Gists: write**（用户级权限，仅够读写 Gist）→ 生成并复制（`github_pat_…`）
3. WordCard 设置 → 云同步 → 粘贴 Token → 保存（自动验证有效性）
4. 首台设备点「立即上传」自动创建私有 Gist；其他设备填同一 Token，启动时自动绑定

安全说明：Token 由 Electron `safeStorage` 加密后存于用户数据目录（`%APPDATA%/wordcard/sync-config.json`），
主进程之外无明文；GitHub 侧可随时吊销该 Token。同步需本机可访问 `api.github.com`（国内网络不稳定时启动拉取会静默失败，可在设置中手动重试）。

## 数据模型

字段命名与导入的 `vocabulary.json` 完全一致，核心类型定义见 `src/shared/word-types.ts`（渲染层路径 `@/types/vocabulary` 为其
re-export）：

```ts
interface WordEntry {
    id: string
    word: string              // immutable
    pronunciation: string     // /ɪˈmjuːtəbl/
    partOfSpeech: string      // adjective (形容词)
    coreMeaning: string       // 不可变的（字符串，卡片「核心含义」原样展示）
    example: string           // 英文例句（目标词高亮）
    translation: string       // 例句的中文翻译（卡片「我的理解」）
    collocations: Collocation[]   // [{ en: "immutable object", zh: "不可变对象" }]
    extendedMeanings: string[]    // 其他义项（卡片「其他义项」）
    status: WordStatus            // 'new' | 'learning' | 'mastered'
    createdAt: number
    updatedAt: number
    reviewCount: number
    lastRating: Rating | null      // 'unknown' | 'fuzzy' | 'known'
    starred: boolean
}
```

导入 JSON 使用宽松的 `RawWordInput` 形状（除 `word` 外全部可选）：

```json
[
  {
    "word": "immutable",
    "pronunciation": "/ɪˈmjuːtəbl/",
    "partOfSpeech": "adjective (形容词)",
    "coreMeaning": "不可变的",
    "example": "Immutable data structures make state changes easy to trace.",
    "translation": "不可变数据结构让状态变更易于追踪。",
    "collocations": [
      {
        "en": "immutable object",
        "zh": "不可变对象"
      }
    ],
    "extendedMeanings": [
      "不可改变的"
    ]
  }
]
```

也接受 `{ "words": [...] }` 包装形式。

## UI 规范（暗黑主题）

| 令牌                | 值        | 用途                    |
|---------------------|-----------|-------------------------|
| `--color-base`      | `#0d0d0d` | 应用背景                |
| `--color-card`      | `#1a1a1a` | 卡片背景                |
| `--color-line`      | `#262626` | 微弱边框                |
| `--color-ink`       | `#ffffff` | 主标题 / 单词           |
| `--color-ink-soft`  | `#e0e0e0` | 次要正文                |
| `--color-ink-muted` | `#a0a0a0` | 弱化文字                |
| `--color-accent`    | `#00c853` | 高亮绿（状态 / 主操作） |
| `--color-warn`      | `#ffb300` | 学习中状态              |
| `--color-danger`    | `#ff5252` | 不认识评级              |

设计令牌集中在 `src/renderer/src/assets/main.css` 的 Tailwind v4 `@theme` 中，改一处即可全局换肤。

## 项目结构

```
word-card-app/
├── electron.vite.config.ts      # electron-vite 配置（main / preload / renderer 三段式）
├── package.json
├── pnpm-workspace.yaml          # pnpm 12 项目配置（allowBuilds 构建脚本白名单）
├── .npmrc                       # Electron 二进制 npmmirror 镜像
├── tsconfig.json
├── tests/
│   └── sync-merge.test.ts      # mergeWords / sanitize 纯函数单测（node:test）
├── src/
│   ├── main/
│   │   ├── index.ts            # Electron 主进程：窗口、原生文件对话框 IPC、sync 注册
│   │   └── sync.ts             # Gist 云同步服务：token 加密 / REST 客户端 / 自动发现创建
│   ├── preload/index.ts         # 预加载：contextBridge 暴露 electronAPI
│   ├── shared/
│   │   ├── electron-api.ts     # 主/渲染进程共享的 IPC 契约类型
│   │   ├── word-types.ts       # 单词数据模型（三端共享）
│   │   └── sync-types.ts       # 云同步 payload / 结果类型
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue                   # 应用外壳 + 弹窗挂载 + Toast + 启动自动拉取
│           ├── env.d.ts                  # Window.electronAPI 全局类型
│           ├── assets/main.css           # Tailwind v4 主题令牌与基础样式
│           ├── types/vocabulary.d.ts     # 数据模型 re-export（定义在 shared/word-types.ts）
│           ├── stores/
│           │   ├── vocab.ts              # 词库 / 牌组 / 评级 / 导入导出 / 持久化 / 同步合并
│           │   ├── sync.ts               # 云同步状态机（init/saveToken/pull/push）
│           │   └── ui.ts                 # 弹窗与 Toast 状态
│           ├── composables/
│           │   ├── usePersist.ts         # localStorage 持久化 ref
│           │   └── useSpeech.ts          # 系统 Speech API 封装
│           ├── utils/
│           │   ├── text.ts               # HTML 转义 / 例句高亮
│           │   ├── word.ts               # 词条规范化
│           │   └── mergeWords.ts         # 词级合并纯函数 + payload 校验
│           ├── components/
│           │   ├── TitleBar.vue          # 顶部拖拽区（原生窗口按钮）
│           │   ├── WordCard.vue          # 核心单词卡片组件
│           │   ├── WordListPanel.vue     # 侧边栏：搜索 / 筛选 / 统计 / 列表
│           │   ├── BaseModal.vue         # 弹窗基座
│           │   ├── ImportDialog.vue      # 导入生词
│           │   ├── SettingsDialog.vue    # 设置（含云同步）
│           │   └── ConfirmDialog.vue     # 通用确认弹窗（重置 / 清空）
│           └── views/HomeView.vue        # 主视图 + 键盘快捷键监听
```

## 架构说明

- **三段式构建**：`electron-vite` 分别打包 main（CJS）、preload、renderer；主进程通过 `titleBarStyle: 'hidden'` +
  `titleBarOverlay` 获得无边框暗色标题栏，原生窗口按钮由系统绘制
- **状态管理**：Pinia setup store 拆分「持久化状态」（词库、设置）与「会话状态」（筛选、当前位置、翻面）；`usePersistedRef` 以深度
  watch 实现写入即持久化
- **牌组模型**：`deck = 筛选结果 + 播放顺序`，导航 / 评级均基于 deck，筛选与乱序对复习流程即时生效
- **安全细节**：渲染层 `contextIsolation: true` + `nodeIntegration: false`；例句高亮先 HTML 转义再插入 `<mark>`，防止词库内容注入
- **快捷键防冲突**：全局 `keydown` 监听会跳过输入框焦点，且弹窗打开时自动屏蔽
- **云同步边界**：token 明文与 GitHub 网络请求只存在于主进程（safeStorage 加密存 userData）；preload 仅 IPC 透传；渲染层只做合并（
  `mergeWords` 纯函数，按 `updatedAt` 词级 LWW）与 UI
