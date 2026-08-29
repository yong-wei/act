## Why

v2 验证注册表已经为每个已审核错因提供独立验证题，但现有微辅导同步只物化 `TeachingResource`。编排器要求治理投影与 `AdaptiveAssessmentItemRef` 同时命中；干净库交集为空，已归因错题因此返回 `VALIDATION_QUESTION_UNAVAILABLE`。资格检查只看静态投影，学生仍会看到开始入口，真正创建任务时才被拒绝。

## What Changes

- 从 `micro-tutoring-validation-registry-v2.json` 确定性物化合格验证题的 `AdaptiveAssessmentItemRef`，写入与当前 catalog 一致的内容哈希、题目版本、`itemRevision`、捕获修订和 `learnerVisible`。
- 将该快照同步纳入现有微辅导同步入口，避免只同步 TeachingResource 的半完成状态。
- 已存在且身份、哈希与治理元数据一致的记录保持幂等；缺失、哈希漂移、版本漂移、治理元数据冲突或脏工作区 fail-closed，并输出可诊断缺口。
- 不通过浏览或预先作答验证题来偶然创建快照，也不放宽编排器 fail-closed。
- 将编排失败原因 `VALIDATION_QUESTION_UNAVAILABLE` 映射为明确的学生可见中文提示。

## Capabilities

### New Capabilities

- 无。本变更把既有 v2 验证投影物化到 `AdaptiveAssessmentItemRef`，不新增独立能力名称。

### Modified Capabilities

- `micro-tutoring-validation-registry`: 要求 v2 注册表中的每条启用验证题在 `AdaptiveAssessmentItemRef` 上具有与当前 catalog 内容哈希、版本和治理元数据一致的快照，并与同一 Git 捕获修订对齐；编排在快照缺失时继续返回 `VALIDATION_QUESTION_UNAVAILABLE`，学生界面 MUST 给出明确中文说明。

## Impact

- 影响微辅导同步 CLI、验证注册表消费、`AdaptiveAssessmentItemRef` 物化、`remediation-orchestration` 的真实数据库路径，以及学生微辅导面板对 `VALIDATION_QUESTION_UNAVAILABLE` 的文案。
- 不修改选项归因、v1 验证注册表、资源投影、OSS/ESA 路由或生产激活门禁。
- 不把 `AdaptiveAssessmentItemRef` 改成可变目录真源；历史答题快照仍不可变。
- 生产库只通过既有发布/迁移门禁套用同一同步，本变更不授权生产 activate。
