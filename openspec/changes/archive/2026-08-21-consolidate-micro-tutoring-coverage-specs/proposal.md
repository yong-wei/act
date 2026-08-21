## Why

Issue #1391 已完成固定 54 题分母和覆盖审计实现，但其完整规范仍停留在活动 change 中；#1392 归档生成的 canonical spec 只保留了选项级归因增量。Issue 状态、活动 change 和正式规范因此互相矛盾，后续 #1394–#1396 无法引用一个完整、稳定的审计合同。

## What Changes

- 将 #1391 已实现的 v1 固定分母、逐错误选项审计、隐私安全引用、Git/DB 捕获修订和严格模式要求补入正式 `micro-tutoring-coverage-audit` 规范。
- 保留 #1392 的精确选项级归因要求，形成一个无缺页的 canonical contract。
- 补齐正式规范的 Purpose，并明确完成 change 的归档与 Issue/系列状态对账规则。
- 不修改运行时代码、54 题 v1 分母或现有生产数据。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `micro-tutoring-coverage-audit`: 正式规范恢复已实现但尚未归档的完整 v1 覆盖审计要求，并规定归档后的规范与系列状态一致性。

## Impact

- 影响 `openspec/specs/micro-tutoring-coverage-audit/`、遗留活动 change 的归档及 #1390/#1391 的治理记录。
- 不改变评估 API、数据库结构、学生端行为或生产启用状态。
