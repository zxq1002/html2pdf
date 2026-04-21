# Phase 2: 导出样式定制 - 执行计划

## 1. 目标需求
- **FEAT-04: 样式定制 - 字体大小** (用户可在 Popup 中选择或输入字体大小)。
- **FEAT-05: 样式定制 - 页边距** (预设值：窄、标准、宽，或自定义)。
- **FEAT-07: 持久化配置** (使用 chrome.storage 记录用户的导出偏好)。
- **元数据优化**: 自动根据提取的文章标题设置 PDF 文件名。

## 2. 执行步骤

### Wave 1: UI 更新与配置持久化
- **文件**: `popup.html`, `popup.js`, `popup.css`
- **任务**:
    - 在 Popup 中添加“字体大小”和“页边距”控件。
    - 实现 `chrome.storage.local` 的加载与保存逻辑。
    - 确保用户选择的偏好设置在关闭弹窗后仍能保留。

### Wave 2: 样式注入与元数据处理 (TDD)
- **文件**: `content.js`, `tests/style-injection.test.js`
- **任务**:
    - 编写测试验证样式参数传递逻辑。
    - 修改 `content.js`，在阅读模式下动态应用字体大小。
    - 修改 `content.js`，为 `html2pdf` 配置动态页边距。
    - 优化文件名生成逻辑，优先使用 Readability 提取的标题。

## 3. 详细计划
详细的分步计划已分解为以下文件：
1. [02-01-PLAN.md](../phases/02-style-customization/02-01-PLAN.md) - UI 组件与持久化设置
2. [02-02-PLAN.md](../phases/02-style-customization/02-02-PLAN.md) - 样式注入与文件名逻辑 (TDD)
