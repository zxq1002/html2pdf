# 代码库结构

**分析日期:** 2025-05-14

## 目录布局

```
html2pdf/
├── icons/              # 扩展图标和资源生成脚本
├── lib/                # 第三方库（捆绑）
├── .planning/codebase/ # 架构和映射文档
├── background.js       # Service worker (后台进程)
├── content.js          # 注入的内容脚本
├── manifest.json       # 扩展配置
├── popup.html          # 弹出界面 UI
├── popup.js            # 弹出界面逻辑
├── popup.css           # 弹出界面样式
├── README.md           # 项目文档
└── LICENSE             # 许可证文件
```

## 目录用途

**icons/:**
- 用途: 存储各种尺寸的扩展图标以及生成这些图标的脚本。
- 包含: PNG 图像和 Python 生成脚本。
- 关键文件: `generate_icons.py`

**lib/:**
- 用途: 存储缩减版的第三方依赖，以避免外部网络请求。
- 包含: 捆绑的 JavaScript 库。
- 关键文件: `html2pdf.bundle.min.js`

**.planning/codebase/:**
- 用途: 包含代码库映射和架构文档。
- 包含: Markdown 文件。

## 关键文件位置

**入口点:**
- `manifest.json`: 定义所有扩展入口点。
- `popup.html`: 主要 UI 入口点。
- `background.js`: 后台进程入口点。

**配置:**
- `manifest.json`: 权限和资源。

**核心逻辑:**
- `content.js`: 主要的 PDF 生成和 DOM 操作逻辑。
- `popup.js`: 导出过程的编排。

**测试:**
- 不适用（未发现测试）。

## 命名约定

**文件:**
- 核心扩展文件使用短横线命名法 (Kebab-case) (`background.js`, `manifest.json`)。
- 工具脚本使用蛇形命名法 (Snake_case) (`generate_icons.py`)。

**目录:**
- 单个单词或短横线命名法。

## 如何添加新代码

**新导出功能:**
- 主要逻辑: 添加到 `content.js`（DOM 处理）和 `popup.js`（UI/触发器）。
- UI 控件: 添加到 `popup.html`。

**新组件/模块:**
- 由于没有构建系统，新模块应作为独立文件添加，并包含在 `manifest.json` 中或动态加载。

**实用程序:**
- 共享助手: 可以根据范围添加到新的 `utils/` 目录或 `background.js`/`content.js` 的底部。

## 特殊目录

**icons/:**
- 用途: 扩展的静态资源。
- 生成方式: 部分通过 `generate_icons.py` 生成。
- 是否提交: 是。

---

*结构分析: 2025-05-14*
