## ADDED Requirements

### Req: single source of truth for Arena event types

`telemetry.ts` 的 `ARENA_CORE_EVENT_TYPES` 和 `arena-event-dictionary.ts` 的 `ARENA_CORE_EVENT_TYPES` 必须合并为单一来源。建议 `telemetry.ts` 从 `arena-event-dictionary.ts` 导入。

### Req: high-value events materialized as LearningFact

数据治理链路必须将以下 Arena 事件物化：
- `arena_evaluation_complete` + `valid=true` → `factType: arena_submission_valid`, `competency: 参数设计与调优`
- `arena_evaluation_complete` + `valid=false` → `factType: arena_submission_failed_constraint`, `competency: 工程决策与约束`
- `arena_identification_model_save` → `factType: arena_identification_model_saved`, `competency: 跨域迁移与联动`

### Req: student profile and teacher insights can consume Arena facts

学生画像和教师端班级洞察必须能够读取 Arena fact 计数（至少：有效提交数、约束失败数、辨识模型保存数）。

### Req: tests cover valid / invalid / blackbox event materialization

单元测试必须覆盖上述三类事件的 LearningFact 生成。
