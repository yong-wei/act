## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

以学生从“看到建议”到“完成学习并形成记录”的链路为核心。路径中心负责解释当前路径和下一步，证据页负责显示来源和可复盘动作，任务/练习/作品集负责记录完成或说明不能写回。实现应复用 `adaptive-learning-center-ui` 和 `student-feedback-task-contract`，不得用静态演示路径掩盖真实 path:null。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-remediation-student-path-evidence-loop-closure --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
