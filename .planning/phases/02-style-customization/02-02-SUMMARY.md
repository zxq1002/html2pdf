---
phase: 02-style-customization
plan: 02-02
subsystem: content-script
tags: [style-injection, readability, tdd]
requires: [02-01]
provides: [FEAT-04, FEAT-05]
tech-stack: [javascript, readability.js, jest, jsdom]
key-files: [content.js, tests/style-injection.test.js]
status: complete
duration: 15m
---

# Phase 02 Plan 02: 样式注入与文件名优化 Summary

## 任务目标
在内容脚本中应用动态样式（字体大小、页边距），并优化 PDF 文件名为文章标题。通过 TDD 确保逻辑正确。

## 已完成工作

### 1. 内容提取优化
- 修改了 `extractReadableContent` 函数，现在不仅返回提取的 DOM 元素，还返回由 `Readability` 提取的文章标题 (`extractedTitle`)。

### 2. 动态样式注入
- 修改了 `generatePDF` 函数，使其接收 `fontSize` 和 `margin` 参数。
- **字体大小**: 动态注入到 PDF 预览 iframe 的 body 样式中，支持数字（自动加 px）或字符串。
- **页边距**: 实现了边距映射逻辑。支持 'narrow' (5mm), 'normal' (15mm), 'wide' (30mm) 以及自定义数值或数组。

### 3. 文件名优化
- `generatePDF` 现在优先使用提取的文章标题作为文件名，若不存在则回退至原始页面标题。文件名经过安全处理，移除了非法字符。

### 4. TDD 验证
- 创建了 `tests/style-injection.test.js`，包含 4 个测试用例：
  - 验证 `extractReadableContent` 返回结构。
  - 验证 `fontSize` 正确注入 CSS。
  - 验证 `margin` 参数映射逻辑（测试了 'narrow' 到 5mm 的映射）。
  - 验证优先使用 `extractedTitle` 作为文件名。
- 所有测试在 JSDOM 环境下通过。

## 变更记录

| 变更类型 | 文件 | 描述 |
| --- | --- | --- |
| `feat` | `content.js` | 实现样式注入和文件名优化逻辑 |
| `test` | `tests/style-injection.test.js` | 新增样式注入逻辑测试 |

## 偏差说明
- **测试环境兼容性**: 在 Jest/JSDOM 测试环境中，由于缺乏 `FileReader` 和 `setImmediate` 的完整实现，在 `tests/style-injection.test.js` 中添加了相应的 Polyfill 以支持 `content.js` 的执行。

## 自我检查
- [x] 创建的文件存在
- [x] 逻辑通过自动化测试
- [x] 代码符合项目规范

## Self-Check: PASSED
