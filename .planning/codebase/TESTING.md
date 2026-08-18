# 测试模式

**分析日期:** 2025-05-14（**最近更新:** 2026-08-19）

## 测试框架

**运行器 (Runner):**
- Jest 30（`jest-environment-jsdom`，jsdom 26 显式声明）。

**断言库 (Assertion Library):**
- Jest 内置 `expect`。

**运行命令:**
```bash
npm test        # 运行全部测试
npx jest tests/cleaner.test.js   # 运行单个套件
```

## 测试文件组织

**位置:**
- `tests/` 目录，共 4 个套件、25 个用例（2026-08-19 全部通过）。

**命名:**
- `<模块名>.test.js`（如 `cleaner.test.js`、`performance.test.js`）。

## 测试结构

**模式:**
- 通过 `fs.readFileSync` 读取源文件并 `eval` / `window.eval` 进 jsdom 环境执行，
  无需构建步骤即可测试浏览器脚本。
- `content.js` 与 `src/pdf.js` 在文件末尾将内部函数挂载到 `window`，供测试直接访问。
- 部分用例通过字符串替换（如 `async function generatePDF` → `global.generatePDF = async function`）暴露被测函数。

## 模拟 (Mocking)

**框架:** Jest `jest.fn()`。

**常见 mock:**
- `chrome.runtime`（`getURL`/`sendMessage`/`id`）
- `window.html2pdf`（链式 API：set/from/output）
- `window.extract`（Readability 提取结果）
- `document.createElement` 拦截 iframe 并伪造 `contentDocument`（`scrollHeight` 等）
- `FileReader` / `fetch`

## 覆盖率 (Coverage)

**要求:** 无强制阈值要求。

## 测试类型

**单元测试:**
- `cleaner.test.js`: 噪声移除、链接密度、空元素、文本模式等清理规则（13 例）。
- `extractor.test.js`: Readability 封装接口。
- `style-injection.test.js`: 阅读模式提取容器、字号应用、边距映射、文件名优化。
- `performance.test.js`: DOM 克隆过滤、长页面 scale 降级、canvas 高度上限拦截、质量/压缩参数。

**集成测试:**
- 无。

**端到端 (E2E) 测试:**
- 无（浏览器扩展环境限制，发布前需手动回归）。

## 常见模式

- 通过在 Chrome (`chrome://extensions`) 中加载扩展并在各种网站上触发导出进行手动测试。
- 修改 `content.js`/`src/*.js` 后运行 `npm test` 回归；涉及注入顺序变更时同步更新测试的文件加载逻辑。

---

*测试分析: 2025-05-14；更新: 2026-08-19（Jest 测试体系建立与扩充）*
