# 技术栈 (Technology Stack)

**分析日期：** 2025-05-14

## 语言 (Languages)

**主要语言：**
- JavaScript (ES6+) - `background.js`, `content.js` 和 `popup.js` 中的核心扩展逻辑。
- HTML5/CSS3 - `popup.html` 和 `popup.css` 中的弹出窗口 UI。

**次要语言：**
- Python 3 - 图标生成脚本 `icons/generate_icons.py`。

## 运行时 (Runtime)

**环境：**
- Chrome 扩展 (Manifest V3) - 整个代码库的目标环境。

**包管理器：**
- 无 - 未发现 `package.json`；依赖项是手动捆绑的。
- 锁定文件：缺失。

## 框架 (Frameworks)

**核心框架：**
- html2pdf.js - 在 `content.js` 中用于通过 `html2canvas` 和 `jsPDF` 将 HTML 转换为 PDF。

**测试框架：**
- 未检测到 - 未发现测试框架。

**构建/开发工具：**
- 未检测到 - 无自动化构建系统；手动文件管理。

## 关键依赖项 (Key Dependencies)

**关键项目：**
- `lib/html2pdf.bundle.min.js` - PDF 生成的必备库。

**基础设施：**
- Chrome 扩展 API - `tabs`, `scripting`, `downloads`, `storage` (local)。

## 配置 (Configuration)

**环境配置：**
- `manifest.json` - 定义扩展权限、入口点和资源。

**构建配置：**
- 不适用

## 平台要求 (Platform Requirements)

**开发要求：**
- Chrome 浏览器（用于测试/加载解压后的扩展程序）。
- Python 3（可选，用于图标生成）。

**生产要求：**
- Chrome 88+（Manifest V3 所需）。

---

*技术栈分析：2025-05-14*
