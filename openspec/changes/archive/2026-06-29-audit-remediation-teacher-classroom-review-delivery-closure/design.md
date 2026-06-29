## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

以教师日常操作顺序作为边界：课堂运行结束后进入复盘，复盘生成或定位报告，报告可以导出/发送/进入评分，评分和证据处置可以回写补强任务或课前包。实现应复用 `src/lib/teacher-report-grading-contracts.ts`、`src/lib/data-governance/teacher-evidence-governance.ts`、`ActionStatusPanel` 和教师报告 layout，不应创建第二套报告或评分状态词。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-remediation-teacher-classroom-review-delivery-closure --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
