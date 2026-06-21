## 1. Action Contract

- [ ] 1.1 Define role-scoped graph-center action payloads for student, teacher, and admin contexts.
- [ ] 1.2 Add disabled and degraded reason codes for missing path, resource, citation, overlay, or authorization context.
- [ ] 1.3 Ensure action targets use server-owned ids and route ledger entries.

## 2. UI Integration

- [ ] 2.1 Add action groups to selected node detail and non-canvas fallback views.
- [ ] 2.2 Add student actions for path entry, resource inspection, evidence review, and Konling graph question.
- [ ] 2.3 Add teacher actions for weak-node diagnosis, resource gap inspection, and prep-pack generation/review entry.
- [ ] 2.4 Add admin diagnostics for resource binding, citation readiness, and stale artifact limitations.

## 3. Verification

- [ ] 3.1 Add unit tests for action derivation by role and overlay state.
- [ ] 3.2 Add Playwright coverage for desktop graph, learner mode, teacher coverage mode, and mobile drawer detail.
- [ ] 3.3 Verify unauthorized actions remain hidden or disabled with explicit reasons.
- [ ] 3.4 Run `rtk openspec validate make-graph-center-actionable --strict`.
