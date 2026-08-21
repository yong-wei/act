# #1390/#1391 系列状态对账

记录日期: 2026-08-21
HEAD: `606846ce6e2ce5fc54811f14fb75c7801e5fda9f`（整理前基线）；归档后以本 change 的提交为准。

本记录只对账规范权威与 Issue 状态，**不把规范整理描述为 54/54 运行时完成**。

## GitHub 事实

| Issue | 标题摘要 | GitHub state | status 标签 | 说明 |
| --- | --- | --- | --- | --- |
| #1390 | 微辅导全题覆盖 Epic | OPEN | `status:tracking` / `type:series-parent` | 跟踪父 Issue，不得认领；后续 #1393–#1396 仍开放 |
| #1391 | 覆盖矩阵与审计门禁 | CLOSED | `status:archived` | 实现已完成；整理前 OpenSpec change 仍停在活动目录 |
| #1392 | 选项级错因归因 | CLOSED | `status:archived` | 归档工件 `openspec/changes/archive/2026-08-21-add-micro-tutoring-option-attribution/` 保持不可变 |

## OpenSpec lineage

1. `#1392` 归档创建了 `micro-tutoring-coverage-audit` canonical spec，但只带入「覆盖审计仅接受精确的选项级归因目录」。
2. `#1391` 的 `add-micro-tutoring-coverage-audit-gate` 任务全完成，整理前仍在 `openspec/changes/`；四项完整要求未进入正式规范。归档前证据见 `pre-archive-add-micro-tutoring-coverage-audit-gate.md`。
3. 本 change 按标准流程归档 `add-micro-tutoring-coverage-audit-gate` 为 `openspec/changes/archive/2026-08-21-add-micro-tutoring-coverage-audit-gate/`，将固定 54 题分母、逐错误选项链路、严格门禁和可重复验证合入正式 spec。
4. 本 change 再补齐 Purpose 与「完整归档 lineage」治理要求后自身归档。

## 非结论

- 覆盖审计严格模式仍可因受治理依赖缺口失败。
- 本整理完成后，#1390 仍保持 tracking；不得据此宣称生产资格或 54/54 全覆盖。
