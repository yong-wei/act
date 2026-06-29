## Why

剩余未关闭项里教师线数量最大，问题集中在课堂结束/删除影响范围、复盘后续动作、报告交付账本、评分 deep link、学生证据处置和课前包近场入口。已有 ledger 和 status 基础能力，但多个垂直页面没有接入完整状态机。

## What Changes

- 把教师课堂结束、删除、复盘、报告交付、评分、学生证据处置和课前包入口纳入同一垂直整改。
- 要求每个教师动作显示影响范围、执行状态、失败恢复和审计证据。
- 补齐移动端教师长报告/评分/证据页面的主动作固定区和上下文保留。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-teacher-report-delivery-ledger`: 要求报告交付账本覆盖复盘、长报告、移动主动作和缺失上下文恢复。
- `audit-remediation-teacher-report-grading`: 要求评分工作台保留 classId/source/gradingRun 上下文并产品化方法边界。
- `teacher-evidence-governance`: 要求教师侧学生证据支持核验、处置和补强任务创建闭环。
- `audit-remediation-teacher-classroom-lifecycle`: 要求课堂结束、删除和复盘入口展示影响范围与稳定落点。
- `teacher-prep-pack-generation`: 要求班级诊断与课前包复核形成近场动作链。

## Impact

影响教师首页、班级详情/分析、课堂 review、历史、report ledger、grading workbench、teacher evidence drawer、prep-pack review surface 及相关 API/status tests。
