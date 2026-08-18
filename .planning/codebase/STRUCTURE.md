# 代码库结构

**分析日期:** 2025-05-14（**最近更新:** 2026-08-19）

## 目录布局

```
html2pdf/
├── icons/              # 扩展图标和资源生成脚本
├── lib/                # 第三方库（捆绑）
├── src/                # 自有功能模块（按需注入）
├── tests/              # Jest 单元测试
├── .planning/codebase/ # 架构和映射文档
├── content.js          # 注入的内容脚本（主编排）
├── manifest.json       # 扩展配置（无 background，按需注入）
├── popup.html          # 弹出界面 UI
├── popup.js            # 弹出界面逻辑
├── popup.css           # 弹出界面样式
├── README.md           # 项目文档
└── LICENSE             # 许可证文件
```

> [2026-08-19] `background.js` 已删除（原有 handler 均为死代码）；
> 新增 `src/`（extractor.js / cleaner.js / pdf.js）与 `tests/`。

## 目录用途

**icons/:**
- 用途: 存储各种尺寸的扩展图标以及生成这些图标的脚本。
- 包含: PNG 图像和 Python 生成脚本。
- 关键文件: `generate_icons.py`

**lib/:**
- 用途: 存储缩减版的第三方依赖，以避免外部网络请求。
- 包含: 捆绑的 JavaScript 库。
- 关键文件: `html2pdf.bundle.min.js`（仅图片 PDF 导出时懒加载）、`Readability.js`

**src/:**
- 用途: 自有功能模块，由 popup 通过 `chrome.scripting.executeScript` 按需注入。
- 关键文件:
  - `extractor.js`: Readability 封装，提供 `extract(doc)` 接口
  - `cleaner.js`: 内容清理模块（噪声选择器/链接密度/空元素/文本模式，挂载 `window.__pdfCleaner`）
  - `pdf.js`: 图片 PDF 生成管线（DOM 克隆、html2pdf 渲染、图片修复、blob 下载）

**tests/:**
- 用途: Jest 单元测试（jsdom 环境，直接 eval 源文件）。
- 关键文件: `extractor.test.js`、`cleaner.test.js`、`style-injection.test.js`、`performance.test.js`

**.planning/codebase/:**
- 用途: 包含代码库映射和架构文档。
- 包含: Markdown 文件。

## 关键文件位置

**入口点:**
- `manifest.json`: 定义扩展入口点（仅 popup，无 background）。
- `popup.html`: 主要 UI 入口点。

**配置:**
- `manifest.json`: 权限（activeTab/scripting/storage）与 web_accessible_resources。

**核心逻辑:**
- `popup.js`: 导出过程编排（注入顺序：Readability → extractor → cleaner → pdf → content）。
- `content.js`: 导出主编排（模式分发、正文提取、进度上报）。
- `src/pdf.js`: 图片 PDF 渲染管线。
- `src/cleaner.js`: 内容清理统一实现。

**测试:**
- `tests/`：4 个测试套件共 25 个用例，`npx jest` 运行。

## 命名约定

**文件:**
- 核心扩展文件使用短横线命名法 (Kebab-case) (`background.js`, `manifest.json`)。
- 工具脚本使用蛇形命名法 (Snake_case) (`generate_icons.py`)。

**目录:**
- 单个单词或短横线命名法。

## 如何添加新代码

**新导出功能:**
- 主要逻辑: 按职责添加到 `content.js`（编排/提取）、`src/pdf.js`（渲染）或 `src/cleaner.js`（清理），并在 `popup.js` 中编排。
- UI 控件: 添加到 `popup.html`。
- 新增注入文件: 同步更新 `popup.js` 的 `ensureContentScriptInjected` 文件列表与相关测试的加载逻辑。

**新组件/模块:**
- 无构建系统，新模块作为独立文件放入 `src/`，使用 `function` 声明与 IIFE（避免重复注入时 const/let 报错）。

**实用程序:**
- 共享助手: 添加到 `src/` 下对应模块，或新建模块文件。

## 特殊目录

**icons/:**
- 用途: 扩展的静态资源。
- 生成方式: 部分通过 `generate_icons.py` 生成。
- 是否提交: 是。

---

*结构分析: 2025-05-14；更新: 2026-08-19（模块拆分与 background 移除）*
