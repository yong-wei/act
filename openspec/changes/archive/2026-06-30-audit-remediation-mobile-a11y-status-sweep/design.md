## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

本变更应作为扫尾 gate，而不是替代业务整改。它只关闭那些业务行为已经由垂直变更解决、但还缺移动布局或可访问语义证据的 finding。验收必须基于 320px/390px DOM width、focus path、role/status/alert 查询和代表截图。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-remediation-mobile-a11y-status-sweep --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
