## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

本变更只处理审计台账卫生。实现时应读取 `chapters/38-function-state-flows-batch30.md` 中 132/133 的内联整改状态、`audit-remediation-p0-stability` 的归档 proposal/tasks/spec 和 `remediation/audit-remediation-p0-stability/evidence.md`，然后更新主报告的关闭列表、未关闭数量和说明。不得重新审查已经归档的实现证据，也不得借本变更修改课前包功能代码。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-report-closure-ledger-cleanup --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
