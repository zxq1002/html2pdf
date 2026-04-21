# 编码规范 (Coding Conventions)

**分析日期：** 2025-05-14

## 命名模式 (Naming Patterns)

**文件：**
- 扩展文件：短横线命名法 (kebab-case)（如 `background.js`, `content.js`）。
- 脚本：蛇形命名法 (snake_case)（如 `generate_icons.py`）。

**函数：**
- 驼峰命名法 (camelCase)（例如 `handleExportPDF`, `sanitizeFilename`）。

**变量：**
- 驼峰命名法 (camelCase)（例如 `contentElement`, `pdfBlob`）。
- 常量使用大写蛇形命名法 (CONSTANT_CASE)（尽管明确定义的常量较少）。

**类型：**
- 注释中对复杂对象使用隐式的 JSDoc。

## 代码风格 (Code Style)

**格式化：**
- 未检测到自动化工具（无 `.prettierrc`）。
- 风格一致：使用 2 个空格缩进，使用分号。

**规范检查 (Linting)：**
- 未检测到自动化工具（无 `.eslintrc`）。

## 导入组织 (Import Organization)

**顺序：**
1. Chrome API（全局 `chrome` 对象）。
2. 第三方库（通过 `manifest.json` 或动态 `<script>` 注入加载）。
3. 本地组件（消息传递）。

**路径别名：**
- 无。

## 错误处理 (Error Handling)

**模式：**
- 在 `async` 函数中广泛使用 `try...catch`。
- 错误通过消息响应返回：`{ success: false, error: "..." }`。

## 日志记录 (Logging)

**框架：** 原生 `console`。

**模式：**
- 带有前缀的日志：`console.log("[PDF Exporter] ...")`。
- 生命周期事件（安装、接收消息）的信息性日志。

## 注释 (Comments)

**何时注释：**
- 复杂逻辑的函数头。
- 函数内部的主要逻辑块。

**JSDoc/TSDoc：**
- 函数使用简单的 JSDoc 风格注释：
  ```javascript
  /**
   * 处理 PDF 导出请求
   */
  ```

## 函数设计 (Function Design)

**大小：** 混合。`content.js` 中的 `generatePDF` 相对较大（约 100 行）。

**参数：** 倾向于对选项/配置使用对象解构。

**返回值：** 异步操作使用 Promise，通常返回一个带有 `success` 状态的对象。

## 模块设计 (Module Design)

**导出：** 未使用标准的 JS 模块 (ESM)；依赖于全局作用域和 Chrome 扩展消息机制。

**桶文件 (Barrel Files)：** 未使用。

---

*规范分析：2025-05-14*
