# NotebookLM — 本地 AI 知识库

> 拖入文档，直接提问。所有数据都在你的设备上，安全、离线可用。

## ✨ 功能特性

- 📄 **多格式文档支持** — PDF、DOCX、Markdown、TXT，一键拖拽上传
- 🔍 **多级混合检索** — 语义搜索（AI Embedding）+ BM25 关键词 + 全文回退，三层保障
- 🤖 **多模型支持** — OpenAI / Anthropic / Google Gemini / DeepSeek / 自定义 API / 本地 WebLLM
- 🌐 **联网搜索** — 知识库搜不到时自动联网补充（Bing + DuckDuckGo 多路回退）
- 🌤️ **实时天气** — 天气类问题自动拉取 wttr.in 天气数据
- 💬 **多会话管理** — 每个知识库支持独立对话历史
- 📱 **全平台适配** — 桌面端（macOS/Windows/Linux）+ 移动端（Android APK）+ Web PWA
- 🔒 **数据本地化** — 基于 IndexedDB，所有文件存储在本地，绝不离开你的设备
- 🌍 **中英双语** — 完整的中文/English 界面翻译

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript + Vite |
| 桌面/移动 | Tauri 2.x (Rust) |
| 样式 | Tailwind CSS v4 |
| 本地数据库 | Dexie.js (IndexedDB) |
| AI 推理 | Transformers.js (all-MiniLM-L6-v2) + MLC WebLLM |
| 文档解析 | pdfjs-dist + Mammoth.js |
| PWA | vite-plugin-pwa + Workbox |
| 路由 | React Router DOM v7 |

## 🚀 开发

```bash
# 安装依赖
npm install

# 启动 Web 开发服务器
npm run dev

# 启动 Tauri 桌面开发
npm run tauri dev

# Android 构建
npm run tauri:build
# 或只打包 arm64
cargo tauri android build --target aarch64
```

### Android 构建环境要求

- Java 21 (OpenJDK)
- Rust toolchain + Android targets
- Android SDK + NDK 27
- `ANDROID_HOME` / `JAVA_HOME` 环境变量

## 📦 构建产物

- **APK**: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`
- **AAB**: `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`

## 📂 项目结构

```
src/
├── components/      # 可复用 UI 组件
│   ├── Sidebar.tsx         # 桌面端侧边栏
│   ├── MobileSidebar.tsx   # 移动端侧边栏
│   └── MobileTabs.tsx      # 移动端底部导航
├── pages/           # 页面组件
│   ├── Home.tsx            # 首页/引导页
│   ├── KBDetail.tsx        # 知识库详情（核心交互页）
│   └── Layout.tsx          # 布局框架
├── lib/             # 核心业务逻辑
│   ├── chat.ts             # 对话引擎（流式/非流式）
│   ├── documents.ts        # 文档处理、文本分割、混合检索
│   ├── embedding.ts        # AI Embedding 向量搜索
│   ├── sessions.ts         # 会话 CRUD
│   └── web-search.ts       # 联网搜索（多路回退）
├── db/              # 数据库 schema (Dexie.js)
├── stores/          # Zustand 状态管理
├── i18n/            # 中英文国际化
└── src-tauri/       # Tauri (Rust) 桌面/移动端壳
    ├── src/lib.rs           # Rust 入口
    ├── Cargo.toml           # Rust 依赖
    └── tauri.conf.json      # Tauri 配置
```

## 📄 许可

MIT
