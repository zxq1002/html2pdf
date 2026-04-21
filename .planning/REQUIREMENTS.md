# 需求文档 (REQUIREMENTS)

## 1. 核心功能 (Core Features - V1)

### 内容提取与识别 (Content Extraction)
- **FEAT-01: 自动正文识别 (Reading Mode)** - 插件应能智能识别并提取网页正文内容（如 `<article>` 或 `<main>` 标签），为“个人知识库”提供纯净的输入源。
- **FEAT-02: 干扰元素自动剔除** - 自动去除导航栏、侧边栏、广告、弹窗及评论区等无关元素，确保“内容可读性优先”。
- **FEAT-03: 全页导出模式** - 在需要保留完整网页设计的场景下，支持捕捉页面的完整视觉呈现。

### PDF 定制与生成 (PDF Customization & Generation)
- **FEAT-04: 样式定制 - 字体大小** - 用户可在导出前动态调整文字大小，以适应不同的阅读设备。
- **FEAT-05: 样式定制 - 页边距** - 用户可自定义 PDF 的页边距（窄、中、宽或自定义数值）。
- **FEAT-06: 文字可选 PDF** - 生成的 PDF 必须保留文字图层（非纯图片），支持搜索、复制和取词。
- **FEAT-07: 持久化配置** - 自动保存用户的导出偏好（如常用的字体大小和边距设置），提升使用效率。

## 2. 非功能性需求 (Non-Functional Requirements)

- **NFR-01: 生成速度** - 对于标准长度的文章网页，从点击导出到生成 PDF 的过程应在 5 秒内响应。
- **NFR-02: 文件体积控制** - 通过优化资源引用和压缩，确保生成的 PDF 文件体积适中，适合在个人知识库（如 Obsidian, Zotero）中长期存储。
- **NFR-03: 跨域资源兼容性** - 妥善处理网页中的跨域图片和样式，确保 PDF 中的图片能正常显示。

## 3. 成功准则 (Success Criteria)

- **准则 1**: 用户能够通过“阅读模式”将复杂的网页转化为结构清晰、无杂质的 PDF。
- **准则 2**: 生成的 PDF 导入知识管理工具后，文字内容可搜索，排版符合用户自定义的字体和边距要求。
- **准则 3**: PDF 文件体积合理，单篇长文（含图）通常不超过 2MB。

## 4. 追溯矩阵 (Traceability Matrix)

| 需求 ID | 阶段 | 状态 |
|---------|------|------|
| FEAT-01 | Phase 1 | Completed |
| FEAT-02 | Phase 1 | Completed |
| FEAT-03 | Phase 1 | Completed |
| FEAT-04 | Phase 2 | Completed |
| FEAT-05 | Phase 2 | Completed |
| FEAT-06 | Phase 1 | Completed |
| FEAT-07 | Phase 3 | Completed |
| NFR-01  | Phase 1 | Completed |
| NFR-02  | Phase 4 | Pending |
| NFR-03  | Phase 4 | Completed |
