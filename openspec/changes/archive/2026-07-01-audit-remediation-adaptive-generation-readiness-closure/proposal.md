## Why

`audit-remediation-student-path-evidence-loop-closure` 已经关闭真实空路径、坏 pathId、selection/execution/evidence-review 恢复态。审计报告仍保留的自适应残余问题集中在路径生成前置条件：真实 latest path 为空时，learner-state 503、path-advisor-context 403、缺少班级/教师绑定或服务不可用都只落成“请稍后重试”，学生不知道缺什么、谁能处理、是否能继续学习。

## What Changes

- 为路径生成入口增加 readiness contract，区分 ready、missing-class-binding、missing-teacher-binding、learner-state-unavailable、advisor-forbidden、service-unavailable 和 retryable。
- 让路径生成面板和 API 返回同一前置条件模型，提供学生可执行下一步和教师/管理员可排查线索。
- 只处理路径生成前置条件和服务错误，不重复已归档的 path-selection、path-execution、evidence-review、latest path 和 resource return 行为。
- 回写审计报告和 evidence，明确 finding 335 的关闭证据与残余范围。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `adaptive-learning-center-ui`: 增加路径生成 readiness 与服务错误恢复要求。

### Related Capabilities
- `adaptive-learning-path-planning`
- `adaptive-learner-state-service`

## Impact

影响路径生成面板、learner-state/advisor-context 错误处理、learning-path generation API、学生可见恢复状态、教师/管理员排查入口和审计证据。
