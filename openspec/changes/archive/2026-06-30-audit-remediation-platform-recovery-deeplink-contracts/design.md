## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

恢复合同应把对象类型、可安全展示的引用、失败原因类别和下一步动作分离。UI 不应暴露数据库 id 作为主文案；API 不应返回全量数据作为 no-match fallback；权限边界不应静默改道。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-remediation-platform-recovery-deeplink-contracts --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
