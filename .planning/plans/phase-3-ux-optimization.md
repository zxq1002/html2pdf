# Phase 3: 配置持久化与用户体验优化 - 执行计划

## 1. 目标需求
- **生成进度反馈**：在导出过程中，Popup 界面应显示进度条或加载状态，避免用户以为程序卡死。
- **导出结果提示**：导出成功或失败后，提供清晰的视觉反馈（如 Toast 或状态图标）。
- **偏好设置深化**：增加“默认导出模式”（全页/阅读模式）的持久化选项。
- **交互优化**：防止在导出过程中重复点击导出按钮（禁用按钮状态）。

## 2. 执行步骤

### Wave 1: UI 增强与状态机逻辑
- **文件**: `popup.html`, `popup.css`, `popup.js`
- **任务**:
    - 在 popup.html 中添加状态反馈区域（Toast）。
    - 在 popup.css 中定义状态变化和 Toast 的视觉样式。
    - 在 popup.js 中引入 `setUIState` 状态机逻辑，管理 Idle, Processing, Success, Error 状态。
    - 确保“阅读模式”开关的持久化逻辑完整可用。

### Wave 2: 消息通信增强与 TDD 验证
- **文件**: `content.js`, `popup.js`, `tests/ux-logic.test.js`
- **任务**:
    - 在 `content.js` 中增加分步进度消息发送逻辑（捕获中 -> 渲染中 -> 已完成）。
    - 在 `popup.js` 中监听并显示来自 content script 的进度消息。
    - 编写自动化测试验证状态转换和消息处理逻辑。

## 3. 详细计划
详细的分步计划已分解为以下文件：
1. [03-01-PLAN.md](../phases/03-ux-optimization/03-01-PLAN.md) - UI 增强与状态机逻辑
2. [03-02-PLAN.md](../phases/03-ux-optimization/03-02-PLAN.md) - 消息通信增强与 TDD 验证
