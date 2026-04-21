# 代码库关注点 (Codebase Concerns)

**分析日期：** 2025-05-14

## 技术债 (Tech Debt)

**客户端 PDF 生成：**
- **问题：** 在内容脚本中生成大型 PDF（通过 `html2pdf.js`）可能会消耗大量资源，在复杂页面上可能会导致标签页崩溃或内存溢出 (OOM) 问题。
- **涉及文件：** `content.js`
- **影响：** 大型页面可能会导致浏览器标签页不稳定。
- **修复方案：** 如果可能，将生成逻辑移至离屏文档 (offscreen document) 或后台工作线程（尽管 MV3 中的后台工作线程对 DOM 操作有限制）。

**手动依赖管理：**
- **问题：** 没有 `package.json` 或构建系统；`html2pdf.bundle.min.js` 是一个巨大的二进制大对象 (blob)。
- **涉及文件：** `lib/html2pdf.bundle.min.js`
- **影响：** 难以更新依赖，没有摇树优化 (tree-shaking)，存在版本偏移风险。
- **修复方案：** 实施构建系统（例如 Vite, Webpack）并使用 NPM。

## 安全考虑 (Security Considerations)

**跨域资源共享 (CORS) 和 污染 (Taint)：**
- **风险：** `html2canvas` 配置了 `useCORS: true` 和 `allowTaint: true`。虽然这对处理图像是必要的，但如果不小心处理，可能会导致安全问题。
- **涉及文件：** `content.js`
- **当前缓解措施：** 除了浏览器默认保护外，目前没有显式的缓解措施。
- **建议：** 实施更严格的内容安全策略 (CSP) 并验证图像源。

**注入的 IFrame：**
- **风险：** 扩展程序会在页面中注入一个具有高 z-index 的 `iframe`。
- **涉及文件：** `content.js`
- **当前缓解措施：** 在生成后会移除 `iframe`。
- **建议：** 使用更隔离的方法，如 `offscreen` API（Chrome 109+）。

## 性能瓶颈 (Performance Bottlenecks)

**图像预加载：**
- **问题：** 逻辑使用多个 `setTimeout` 调用和每张图像 2 秒的手动超时来等待图像加载。
- **涉及文件：** `content.js`
- **原因：** DOM 渲染与 PDF 生成之间的同步非常脆弱。
- **改进路径：** 使用 `MutationObserver` 或更健壮的图像加载检测机制。

## 脆弱区域 (Fragile Areas)

**可读内容提取：**
- **涉及文件：** `content.js`
- **脆弱原因：** 依赖于简单的启发式选择器（`article`, `main` 等），而这些在不同网站上的差异巨大。
- **安全修改：** 添加更多备用选择器或使用像 `@mozilla/readability` 这样的库。
- **测试覆盖：** 无。

## 测试覆盖缺口 (Test Coverage Gaps)

**核心逻辑：**
- **未测试内容：** PDF 生成、内容提取、消息传递。
- **涉及文件：** `content.js`, `popup.js`, `background.js`
- **风险：** 变更可能会在不知不觉中破坏在不同网站上的核心功能。
- **优先级：** 高。

---

*关注点审计：2025-05-14*
