---
phase: 04-compatibility-performance
plan: 02
subsystem: core-pipeline
tags: [CORS, light-mode, styling]
requires: [NFR-03]
provides: [force-light-mode, enhanced-cors-handling]
tech-stack: [html2canvas, CSS, chrome-storage]
key-files: [popup.html, popup.js, content.js]
decisions:
  - "在克隆 DOM 阶段预先注入 crossOrigin='anonymous'，以最大限度利用浏览器原生 CORS 处理能力。"
  - "为 Failed 图片提供 fetch 降级逻辑，尝试将其转换为 DataURL 以供 html2canvas 渲染。"
  - "通过在 iframe 中注入 :root { color-scheme: light !important } 强制执行浅色模式。"
metrics:
  duration: 25m
  completed_date: "2026-04-21"
---

# Phase 04 Plan 02: Compatibility and Reliability Enhancement Summary

## 任务执行详情

### Task 1: CORS 图片增强处理
- **实现内容**:
    - 在 `content.js` 的 `cloneDocumentForExport` 函数中，为所有克隆的 `<img>` 标签添加了 `crossOrigin = "anonymous"` 属性。
    - 在 `generatePDF` 的图片加载阶段，引入了更健壮的加载与恢复逻辑：
        - 增加到 5 秒的加载超时。
        - 如果图片加载失败（触发 `onerror`），尝试通过 `fetch` 获取图片并将其转换为 DataURL，从而绕过后续 `html2canvas` 可能遇到的 CORS 限制。
- **文件修改**: `content.js`
- **提交**: `5058957`

### Task 2: 强制 Light Mode 支持
- **实现内容**:
    - **Popup UI**: 在 `popup.html` 中添加了“强制浅色模式”开关，默认为开启。
    - **配置持久化**: 修改 `popup.js` 以支持 `forceLightMode` 的加载、保存和导出配置传递。
    - **样式注入**:
        - **Image PDF**: 在 `content.js` 的 `generatePDF` 中，根据配置向 iframe 注入样式：
            - `color-scheme: light !important`
            - 强制 `body` 背景为白色，文字为黑色。
            - 覆盖常见的 `.dark`, `.dark-mode` 等类名的背景与颜色。
        - **Vector PDF**: 在 `popup.js` 的 `exportToPDFVector` 中同步支持了浅色模式注入，确保两种导出模式体验一致。
- **文件修改**: `popup.html`, `popup.js`, `content.js`
- **提交**: `85f0c0d`

## 偏离记录

### Auto-fixed Issues
None - 计划执行顺利。

### 改进建议 (Noted)
- 虽然提供了 fetch 降级，但对于完全不支持跨域访问且未配置 CORS 响应头的图片（且未部署代理服务器的情况下），仍然可能无法在 Image PDF 中显示。目前已通过控制台警告提示用户。

## 自检：已通过
- [x] 所有修改的文件均已保存。
- [x] `crossOrigin="anonymous"` 已正确注入。
- [x] 强制浅色模式开关功能完整。
- [x] 图片加载超时与恢复逻辑已生效。
