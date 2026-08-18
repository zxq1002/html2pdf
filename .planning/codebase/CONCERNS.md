# 代码库关注点 (Codebase Concerns)

**分析日期：** 2025-05-14（**最近复审：** 2026-08-19）

## 技术债 (Tech Debt)

**客户端 PDF 生成：**
- **问题：** 在内容脚本中生成大型 PDF（通过 `html2pdf.js`）可能会消耗大量资源，在复杂页面上可能会导致标签页崩溃或内存溢出 (OOM) 问题。
- **涉及文件：** `src/pdf.js`
- **影响：** 大型页面可能会导致浏览器标签页不稳定。
- **已缓解（2026-08-19）：** 超长网页自动降 scale；canvas 32767px 高度上限拦截；图片加载并发控制。根本方案（offscreen document）仍待实施。

**手动依赖管理：**
- **问题：** 无构建系统；`html2pdf.bundle.min.js` 是一个巨大的二进制大对象 (blob)。
- **涉及文件：** `lib/html2pdf.bundle.min.js`
- **影响：** 难以更新依赖，没有摇树优化 (tree-shaking)，存在版本偏移风险。
- **已缓解（2026-08-19）：** html2pdf 改为仅图片格式时懒加载，不再常驻页面。修复方案：实施构建系统（例如 Vite, Webpack）并使用 NPM。

## 安全考虑 (Security Considerations)

**跨域资源共享 (CORS) 和 污染 (Taint)：**
- **风险：** `html2canvas` 配置了 `useCORS: true`（`allowTaint: false`）。这对处理图像是必要的。
- **涉及文件：** `src/pdf.js`
- **当前缓解措施：** 图片加载失败时通过 fetch 降级为 DataURL；仅允许 http(s) 来源链接进入 PDF。
- **建议：** 持续关注图像源的验证。

**注入的 IFrame：**
- **风险：** 扩展程序会在页面中注入一个具有高 z-index 的 `iframe`。
- **涉及文件：** `src/pdf.js`
- **当前缓解措施：** 在生成后（含异常路径）会移除 `iframe`。
- **建议：** 使用更隔离的方法，如 `offscreen` API（Chrome 109+）。

## 性能瓶颈 (Performance Bottlenecks)

**图像预加载：**
- **状态：** ✅ 已解决（2026-08-19）
- **方案：** 改为带并发上限（8）的任务池，单图 5s 超时，消除此前多 setTimeout 与无限并发的脆弱同步。
- **涉及文件：** `src/pdf.js`

## 脆弱区域 (Fragile Areas)

**可读内容提取：**
- **涉及文件：** `content.js`, `src/extractor.js`, `src/cleaner.js`
- **脆弱原因：** 依赖启发式选择器与链接密度阈值，不同网站差异大。
- **已缓解（2026-08-19）：** 清理逻辑收敛至 `src/cleaner.js` 统一维护，阈值参数化；已引入 `@mozilla/readability` 本地副本作为主提取引擎。
- **测试覆盖：** `cleaner.test.js` 与 `extractor.test.js` 覆盖核心规则；真实站点效果仍需人工验证。

## 测试覆盖缺口 (Test Coverage Gaps)

**核心逻辑：**
- **已覆盖（2026-08-19）：** 内容清理规则、正文提取、样式注入、PDF 生成配置与 canvas 上限（共 25 个用例）。
- **未测试内容：** popup 导出编排流程、真实浏览器环境下的端到端导出。
- **涉及文件：** `popup.js`
- **风险：** 变更可能会在不知不觉中破坏在不同网站上的核心功能。
- **优先级：** 中（建议发布前在真实站点回归）。

---

*关注点审计：2025-05-14；复审：2026-08-19*
