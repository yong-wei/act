## Context

This change is part of the Product Design audit leftover closure series. Archived `audit-remediation-*` changes are treated as trusted evidence and must not be re-audited. This change targets only the remaining unclosed or partially closed findings assigned to this lane.

## Approach

作者态不应把“浏览资源”和“编排资源”割裂。资源、知识节点和播放列表都应暴露可执行后续动作、保存结果、缺失对象恢复和移动分步结构。实现应延续 ResourceNode/PlanningUnit 治理，不把 RAG chunk 或未审资源直接变成路径节点。

## Boundaries

- Reuse existing platform contracts and primitives before introducing new UI vocabulary.
- Preserve role and privacy boundaries; do not expose raw private evidence, hidden Arena internals, or internal diagnostic strings to students.
- Close audit findings only after implementation evidence exists and is linked back to the report.

## Validation Strategy

- Run `openspec validate audit-remediation-authoring-knowledge-flow-polish --strict`.
- Add focused tests for the route, API, state, or component contracts touched by the implementation.
- Capture browser, DOM-width, focus, status/live, or report evidence when closing visual or accessibility findings.
