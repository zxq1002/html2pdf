# 架构 (Architecture)

**分析日期：** 2025-05-14

## 模式概览 (Pattern Overview)

**总体架构：** Chrome 扩展程序架构 (Manifest V3)

**关键特征：**
- 解耦的组件（弹出窗口 Popup、后台脚本 Background、内容脚本 Content Script）。
- 消息驱动的交互。
- 在目标页面上下文中进行客户端 PDF 生成。

## 分层 (Layers)

**UI 层 (Popup):**
- **目的：** 提供用于配置和触发导出的用户界面。
- **位置：** `popup.html`, `popup.js`, `popup.css`
- **包含：** 配置表单、进度指示器和触发逻辑。
- **依赖：** Chrome Tabs 和 Scripting API。
- **使用者：** 终端用户。

**逻辑层 (Content Script):**
- **目的：** 在网页上下文中执行，用于捕获内容并生成 PDF。
- **位置：** `content.js`
- **包含：** DOM 操作、可读性提取以及 `html2pdf.js` 集成。
- **依赖：** `lib/html2pdf.bundle.min.js`。
- **使用者：** Popup（通过消息传递）。

**服务层 (Background):**
- **目的：** 处理扩展生命周期事件，并提供设置管理等公用服务。
- **位置：** `background.js`
- **包含：** 设置持久化和下载处理。
- **依赖：** Chrome Storage 和 Downloads API。
- **使用者：** Popup 和 Content Script。

## 数据流 (Data Flow)

**PDF 导出流程：**

1. 用户在 `popup.html` 中点击 "导出 PDF"。
2. `popup.js` 收集配置并向 `content.js` 发送 `exportPDF` 消息。
3. `content.js` 提取内容（完整模式或“可读”模式）。
4. `content.js` 创建一个隐藏的 `iframe`，注入内容，并运行 `html2pdf.js`。
5. `content.js` 将生成的 PDF 的 Data URL 返回给 `popup.js`。
6. `popup.js` 触发 `chrome.downloads.download` 来保存文件。

**状态管理：**
- 持久化设置存储在 `chrome.storage.local` 中。
- UI 状态（进度、错误）在 `popup.js` 内部进行本地处理。

## 关键抽象 (Key Abstractions)

**内容提取 (Content Extraction):**
- **目的：** 隔离页面的核心内容以用于“阅读模式”。
- **示例：** `content.js` 中的 `extractReadableContent()`。
- **模式：** 基于启发式的 DOM 选择（搜索 `<article>`, `<main>` 等）。

**PDF 生成流水线 (PDF Generation Pipeline):**
- **目的：** 编排从 DOM 到 PDF 的转换过程。
- **示例：** `content.js` 中的 `generatePDF()`。
- **模式：** 基于策略的模式（通过 `window.print()` 的矢量模式 vs 通过 `html2pdf` 的图像模式）。

## 入口点 (Entry Points)

**操作弹出窗口 (Action Popup):**
- **位置：** `popup.html`
- **触发器：** 用户点击扩展图标。
- **职责：** 渲染 UI 并发起导出。

**后台服务工作线程 (Background Service Worker):**
- **位置：** `background.js`
- **触发器：** 扩展安装、浏览器启动或接收消息。
- **职责：** 初始化和后台任务协调。

## 错误处理 (Error Handling)

**策略：** 在异步函数中使用 try-catch 块并配合 UI 反馈。

**模式：**
- `content.js` 中的错误会被捕获并通过消息响应发回。
- `popup.js` 使用 `showError()` 显示临时错误消息。

## 横切关注点 (Cross-Cutting Concerns)

**日志记录 (Logging)：** 使用带有前缀（如 `[PDF Exporter]`）的 `console.log` 以便过滤。
**验证 (Validation)：** 在 `background.js` 和 `content.js` 中进行基本的文件名清理。
**权限 (Permissions)：** 在 `manifest.json` 中明确请求（`activeTab`, `scripting`, `downloads`）。

---

*架构分析：2025-05-14*
