# 项目背景 (Project Context)

## 概述 (Overview)
**项目名称：** 网页导出 PDF (html2pdf)
**类型：** Chrome 浏览器扩展程序 (Manifest V3)
**核心目标：** 将当前网页导出为高质量、文字可选的 PDF 文件。

## 技术栈 (Technology Stack)
- **核心库：** `html2pdf.js` (集成 `html2canvas` 和 `jsPDF`)。
- **扩展规范：** Chrome Extension Manifest V3。
- **主要语言：** JavaScript (ES6+), HTML5, CSS3。
- **其他工具：** Python (用于图标生成)。

## 主要功能 (Core Features)
- **全页导出：** 捕捉当前页面的完整视觉呈现。
- **阅读模式导出：** 智能提取页面主体内容（如 `<article>` 或 `<main>` 标签），去除杂质。
- **自定义配置：** 通过 Popup 界面调整导出参数。
- **持久化存储：** 保存用户的导出偏好。

## 代码组织 (Organization)
- `manifest.json`: 定义权限（`activeTab`, `scripting`, `storage`）和组件入口。
- `popup/`: 用户交互层（`popup.html`, `popup.js`, `popup.css`）。
- `content.js`: 核心逻辑层，运行在网页上下文中，负责导出编排与内容提取。
- `src/`: 功能模块（`extractor.js` 正文提取、`cleaner.js` 内容清理、`pdf.js` PDF 生成）。
- `lib/`: 存放预编译的第三方依赖。
- `icons/`: 包含不同尺寸的图标资源。

## 工作流规范 (Workflow Conventions)
- **沟通语言：** 中文交互。
- **提交规范：** 英文 Commit Messages。
- **文档维护：** 所有核心决策和架构设计均记录在 `.planning/` 目录下。

---
*最后更新：2025-05-14*
