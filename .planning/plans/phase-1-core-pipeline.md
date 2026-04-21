# Phase 1: 核心链路与阅读模式集成 - 详细执行计划

## 目标需求
- **FEAT-01**: 自动正文识别 (引入 Readability.js)
- **FEAT-02**: 干扰元素自动剔除
- **FEAT-03**: 全页导出模式 (验证稳定性)
- **FEAT-06**: 文字可选 PDF (配置优化)
- **NFR-01**: 生成速度优化

## 计划概览
本阶段分为 4 个执行计划，采用并行与波次（Wave）推进：

1. **Plan 01: 环境初始化与依赖集成 (Wave 1)**
   - 初始化 npm 环境与 Jest 测试框架。
   - 引入 Readability.js 官方库。
2. **Plan 02: 内容提取模块开发 (TDD) (Wave 2)**
   - 编写单元测试验证 Readability 提取逻辑。
   - 封装 `src/extractor.js` 模块。
3. **Plan 03: 核心链路集成与 PDF 优化 (Wave 3)**
   - 在 Content Script 中集成提取逻辑。
   - 优化 `html2pdf.js` 配置，提升速度与 PDF 质量。
4. **Plan 04: UI 增强与验证 (Wave 4)**
   - 更新 Popup 界面，支持模式切换与进度反馈。
   - 进行真实场景的功能验证。

## 详细任务分解

### 1. 依赖管理与环境
- 引入 `Readability.js` 到 `lib/`。
- 配置 `manifest.json` 加载顺序。
- 安装 `jest` 及 `jsdom`。

### 2. TDD 步骤
- **测试环境**: 使用 Jest + JSDOM。
- **测试用例**:
  - 复杂网页正文提取验证。
  - 导航/广告剔除验证。
  - 异常页面降级处理。

### 3. Content Script 更新
- 实现 `src/extractor.js` 封装提取逻辑。
- 更新 `content.js` 的 `handleExportPDF`。
- 优化 `generatePDF` 配置（scale, useCORS）。

### 4. Background/Popup 更新
- 更新 `popup.js` 逻辑，支持不同模式选择。
- 优化进度条更新机制。

---
*注：详细可执行文件已保存至 `.planning/phases/01-core-pipeline/` 目录。*
