## Context

报告 finding 335 指向的不是路径执行 UI，而是生成动作的前置条件解释。已有归档证据说明空路径和坏 pathId 不再进入正常路径内容；剩余问题是当生成依赖的 learner-state 或 path advisor 不可用时，系统不能只要求学生稍后重试。

## Approach

生成 readiness 模型应至少包含：

- `status`: ready, blocked, degraded, retryable.
- `reason`: missing-class-binding, missing-teacher-binding, learner-state-unavailable, advisor-forbidden, service-unavailable, insufficient-evidence.
- `studentAction`: continue-practice, request-teacher-binding, retry, review-evidence, choose-demo.
- `staffAction`: bind-class, check-service, review-permission, inspect-evidence.
- `evidence`: safe source labels and diagnostic codes for logs, not raw internals in student copy.

UI 层展示学生语言；开发/教师/管理员视图可显示排查详情。服务缺失不能让已可引用的证据或保底学习建议失效。

## Boundaries

- 不重做 path-selection、path-execution、evidence-review、latest path 或 resource return。
- 不改变 LearningGoal 目录和路径规划算法。
- 不把 learner-state 服务错误伪装成生成成功。

## Validation Strategy

- Run `openspec validate audit-remediation-adaptive-generation-readiness-closure --strict`.
- Add tests for learner-state 503, advisor 403, missing class binding, missing teacher binding, retryable service failure, and ready state.
- Capture representative UI/DOM evidence for blocked and degraded generation states.
