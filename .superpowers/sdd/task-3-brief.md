# Task 3: Stable Sector Layout

Implement OpenSpec tasks 3.1–3.4 for `redesign-knowledge-graph-direct-manipulation`.

- Replace complete-ring placement with deterministic outward sectors using activation-sequence first-reveal provenance, canonical neighbor ordering, bounded occupied-space scoring, stable center-id tie-breaks, and additional arcs.
- Preserve every visible, user-positioned, existing, and unrelated coordinate; assign automatic fixed coordinates only to newly materialized nodes and reveal relations to existing children without relocation.
- Freeze established 2D/3D coordinates after initial layout; dragging changes only the dragged node and must not reheat the graph.
- Keep explicit reset/relayout working. Test deterministic sectors, reversed response order, overlapping provenance, dense fallback, multiple arcs, existing neighbors, pins, and drag isolation.

Binding constraints: chapter roots use outgoing `contains`; ordinary nodes use canonical incident expansion relations. Commit layout/provenance in activation-intent order, not response order. Preserve winning provenance until graph-version invalidation or explicit relayout. Candidate sectors and tie-breaks must be deterministic. No global force pass, fit-to-view, motion implementation, inspector reorder, or Task 4 behavior.

Workflow: read OpenSpec context; TDD first; run focused tests, typecheck, touched ESLint, OpenSpec strict, diff-check; check only 3.1–3.4; commit locally, do not push/GitHub; write `.superpowers/sdd/task-3-report.md` with evidence and return DONE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED.
