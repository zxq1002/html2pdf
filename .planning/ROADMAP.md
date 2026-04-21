# 项目路线图 (ROADMAP)

本文档定义了项目的交付阶段，每个阶段都映射到具体的需求并具有可验证的成功标准。

## 阶段概览 (Phases)

- [x] **Phase 1: 核心链路与阅读模式集成** - 引入内容提取逻辑，验证 PDF 生成稳定性.
- [x] **Phase 2: 导出样式定制** - 字体、页边距、元数据处理.
- [ ] **Phase 3: 配置持久化与用户体验优化** - 偏好设置界面，生成进度提示.
- [ ] **Phase 4: 兼容性与性能加固** - 长图处理，复杂 CSS 适配.

## 阶段详情 (Phase Details)

### Phase 1: 核心链路与阅读模式集成
**Goal**: 实现网页内容提取并生成基本的文字可选 PDF。
**Depends on**: 无
**Requirements**: FEAT-01, FEAT-02, FEAT-03, FEAT-06, NFR-01
**Success Criteria**:
  1. 用户能点击按钮触发“阅读模式”提取，仅保留文章正文。
  2. 生成的 PDF 文件中，文字可被选中、复制。
  3. 全页导出模式能正确捕捉当前视口之外的内容。
**Plans**:
- [x] 01-01-PLAN.md — 环境初始化与依赖集成 (Wave 1)
- [x] 01-02-PLAN.md — 内容提取模块开发 (TDD) (Wave 2)
- [x] 01-03-PLAN.md — 核心链路集成与 PDF 优化 (Wave 3)
- [x] 01-04-PLAN.md — UI 增强与验证 (Wave 4)
**UI hint**: yes

### Phase 2: 导出样式定制
**Goal**: 让用户能根据需求调整 PDF 的外观。
**Depends on**: Phase 1
**Requirements**: FEAT-04, FEAT-05, FEAT-07
**Success Criteria**:
  1. 用户在 Popup 中修改字体大小，生成的 PDF 文字大小随之改变。
  2. 用户能选择预设或自定义页边距，PDF 布局按预期调整。
  3. 配置能够持久化存储（FEAT-07 提前实现）。
- [x] **Phase 3: 配置持久化与用户体验优化** - 偏好设置界面，生成进度提示.
- [x] **Phase 4: 兼容性与性能加固** - 长图处理，复杂 CSS 适配.

## 阶段详情 (Phase Details)
...
### Phase 3: 配置持久化与用户体验优化
**Goal**: 提供流畅的导出体验并记住用户偏好。
**Depends on**: Phase 2
**Requirements**: FEAT-07
**Success Criteria**:
  1. 刷新页面或重新打开插件，之前的字体和边距设置依然保留。
  2. 导出过程中显示进度提示，避免用户在等待时感到困惑。
**Plans**:
- [x] 03-01-PLAN.md — UI 增强与状态机逻辑 (Wave 1)
- [x] 03-02-PLAN.md — 消息通信增强与 TDD 验证 (Wave 2)
**UI hint**: yes

### Phase 4: 兼容性与性能加固
**Goal**: 提高插件的健壮性，处理极端情况。
**Depends on**: Phase 3
**Requirements**: NFR-02, NFR-03
**Success Criteria**:
  1. 包含跨域图片的网页导出的 PDF 中，图片能正常显示。
  2. 优化后的 PDF 文件体积在长文场景下仍保持在合理范围（如 < 2MB）。
**Plans**:
- [x] 04-01-PLAN.md — 性能基准测试与压缩设置 (Wave 1)
- [x] 04-02-PLAN.md — 跨域资源增强与样式加固 (Wave 2)
- [x] 04-03-PLAN.md — 长网页性能优化与验证 (Wave 3)
**UI hint**: yes

## 进度追踪 (Progress)

| 阶段 | 计划状态 | 状态 | 完成时间 |
|-------|----------|------|----------|
| 1. 核心链路与阅读模式集成 | 4/4 | Completed | 2025-05-14 |
| 2. 导出样式定制 | 2/2 | Completed | 2025-05-14 |
| 3. 配置持久化与用户体验优化 | 2/2 | Completed | 2025-05-14 |
| 4. 兼容性与性能加固 | 3/3 | Completed | 2025-05-14 |

