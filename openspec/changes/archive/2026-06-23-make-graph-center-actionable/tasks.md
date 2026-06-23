## 1. Action Contract

- [x] 1.1 Define role-scoped graph-center action payloads for student, teacher, and admin contexts.
- [x] 1.2 Add disabled and degraded reason codes for missing path, resource, citation, overlay, or authorization context.
- [x] 1.3 Ensure action targets use server-owned ids and route ledger entries.

## 2. UI Integration

- [x] 2.1 Add action groups to selected node detail and non-canvas fallback views.
- [x] 2.2 Add student actions for path entry, resource inspection, evidence review, and Konling graph question.
- [x] 2.3 Add teacher actions for weak-node diagnosis, resource gap inspection, and prep-pack generation/review entry.
- [x] 2.4 Add admin diagnostics for resource binding, citation readiness, and stale artifact limitations.

## 3. Verification

- [x] 3.1 Add unit tests for action derivation by role and overlay state.
- [x] 3.2 Add Playwright coverage for desktop graph, learner mode, teacher coverage mode, and mobile drawer detail.
- [x] 3.3 Verify unauthorized actions remain hidden or disabled with explicit reasons.
- [x] 3.4 Run `rtk openspec validate make-graph-center-actionable --strict`.
