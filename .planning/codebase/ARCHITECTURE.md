# 架构 (Architecture)

**分析日期：** 2025-05-14（**最近更新：** 2026-08-19）

## 模式概览 (Pattern Overview)

**总体架构：** Chrome 扩展程序架构 (Manifest V3)

**关键特征：**
- 解耦的组件（弹出窗口 Popup、内容脚本 Content Script、src 功能模块）。
- 按需注入（activeTab），无常驻 content script，无 background。
- 双渲染通道：矢量打印（浏览器原生 print）与图片 PDF（html2pdf.js）。
- 在目标页面上下文中进行客户端 PDF 生成。

## 分层 (Layers)

**UI 层 (Popup):**
- **目的：** 提供用于配置和触发导出的用户界面；矢量模式打印流程也在此编排。
- **位置：** `popup.html`, `popup.js`, `popup.css`
- **包含：** 配置表单、进度指示器、注入编排与触发逻辑。
- **依赖：** Chrome Tabs、Scripting、Storage API。
- **使用者：** 终端用户。

**逻辑层 (Content Script + src 模块):**
- **目的：** 在网页上下文中执行，用于捕获内容并生成 PDF。
- **位置：** `content.js`（主编排）、`src/extractor.js`、`src/cleaner.js`、`src/pdf.js`
- **包含：** DOM 提取与克隆、内容清理、html2pdf.js 集成、blob 下载触发。
- **依赖：** `lib/Readability.js`；`lib/html2pdf.bundle.min.js`（仅图片格式时懒加载）。
- **使用者：** Popup（通过 `chrome.scripting.executeScript` 调用 `window.__pdfExporterHandleAction`）。

> [2026-08-19] 原服务层（background.js）已删除：其下载/设置 handler 均为死代码，
> 设置读写已收敛到 popup 直接使用 `chrome.storage`，下载改为页面内 blob URL 触发。

## 数据流 (Data Flow)

**矢量 PDF（默认格式）：**

1. 用户在 `popup.html` 中点击 "导出 PDF"。
2. 阅读模式时按需注入脚本并通过 `GET_READABLE_HTML` 提取正文 HTML。
3. `popup.js` 将内容写入隐藏 iframe，注入打印样式后调用浏览器原生打印对话框。

**图片 PDF：**

1. 用户点击导出，`popup.js` 按需注入脚本（含 html2pdf 懒加载）。
2. 通过 `executeScript` 调用 `__pdfExporterHandleAction('exportPDF' | 'EXTRACT_CONTENT')`。
3. `content.js` 提取/克隆内容，`src/pdf.js` 在隐藏 iframe 中渲染并生成 PDF Blob。
4. `src/pdf.js` 在页面内通过 Blob URL 直接触发下载（不再经 base64/消息通道回传）。
5. 进度通过 `chrome.runtime.sendMessage(PROGRESS_UPDATE)` 上报给 popup。

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
- **职责：** 渲染 UI、按需注入内容脚本并发起导出。

> [2026-08-19] 原后台服务工作线程（`background.js`）已移除：无生命周期入口，
> 下载与设置均不再经过后台。

## 错误处理 (Error Handling)

**策略：** 在异步函数中使用 try-catch 块并配合 UI 反馈。

**模式：**
- `content.js`/`src/pdf.js` 中的错误被捕获，并通过 `executeScript` 返回值发回 popup。
- `popup.js` 使用 Toast（`setUIState(STATE.ERROR)`）显示临时错误消息。

## 横切关注点 (Cross-Cutting Concerns)

**日志记录 (Logging)：** 使用带有前缀（如 `[PDF Exporter]`）的 `console.log` 以便过滤。
**验证 (Validation)：** 在 `src/pdf.js` 中进行文件名清理；来源链接仅允许 http(s) 协议（防 XSS）。
**权限 (Permissions)：** 在 `manifest.json` 中最小化请求（`activeTab`, `scripting`, `storage`），无 host_permissions。

---

*架构分析：2025-05-14；更新：2026-08-19（按需注入与 background 移除）*
