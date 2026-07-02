## Why

Current resource and learner-state readiness checks are scattered across database queries, runtime governance artifacts, graph-center coverage, ResourceNode audit state, and student evidence caches. Agents can inspect those sources manually, but there is no single repeatable helper that reports whether the platform data is complete enough for path planning, graph-grounded Konling answers, RAG citations, and diagnostic test accounts.

Recent investigation shows the gap clearly: knowledge nodes have names and descriptions, runtime resource projections exist, and some citation targets are available, but human-confirmed coverage, PlanningUnit readiness, graph-resource bindings, and learner evidence caches are incomplete. Without a dedicated completeness helper, later agents will continue to guess which layer is missing.

## What Changes

- Add a dedicated data-completeness helper for graph, resource, RAG/citation, path-planning, and learner-state readiness.
- Produce machine-readable and human-readable summaries suitable for agents to use while completing resource fields and test fixtures.
- Report completeness by layer rather than collapsing all readiness into one score.
- Include focused support for canonical test accounts, including the Yang Fan account, without creating or modifying mock data in this change.
- Add thresholds and failure modes that distinguish advisory gaps from blockers for path planning, Konling citation tests, and adaptive answering tests.
- Audit source-event-to-derived-evidence continuity so existing facts, snapshots, and caches are not mistaken for complete data when attribution, dedupe, timestamps, or batch processing are missing.
- Apply privacy-minimized output rules for student identifiers, source refs, raw answers, event payloads, and resource content.

## Impact

- Extends data-quality and resource-governance diagnostics.
- Does not complete missing resource semantics or create Yang Fan mock data.
- Establishes the measurement gate that downstream data-completion changes must satisfy before test-account fixtures are generated.
