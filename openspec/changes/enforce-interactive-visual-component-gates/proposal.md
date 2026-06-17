## Why

新增视觉组件如果只依赖人工主观判断，后续仍会回到“设计意图完成不到位”的问题。Product Design 合同要求视觉要素成为验收闸门，并且每个组件都覆盖深浅色、学生端、教师端、非默认状态、manifest 审计和后台数据埋点。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 新增互动课程视觉组件硬闸门。
- 每个 visual 或 control-workbench 嵌入实现必须提交视觉稿路径、学生截图、教师截图、非默认状态截图、manifest audit、测试结果和后台证据样本。
- 验收失败条件包括课程私有重复控制面板、万能 `interactive-figure`、推导卡片列表、非 LaTeX 公式、无公式分块/变色、无图形证据、无热点记录、无教师诊断、工程语义泄露。
- 要求浏览器审核同时覆盖学生和教师角色，且覆盖浅色、深色和至少一个非默认状态。

## Capabilities

### Modified Capabilities

- `commercial-ui-governance-gates`
- `interactive-course-standard-module-migration`
- `interactive-governance-evidence`

## Impact

- 依赖本系列组件能力实现。
- 影响所有后续互动课程视觉组件实现和课程验收。
- 将 Product Design 合同转成可测试、可审计、可阻塞合并的完成标准。
