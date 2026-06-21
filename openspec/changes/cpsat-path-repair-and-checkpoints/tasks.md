## 1. Repair Contract

- [ ] 1.1 Define repair input/output payloads for draft path, bounded alternatives, constraints, version refs, and limitations.
- [ ] 1.2 Define constraint types for prerequisites, time budget, checkpoints, terminal validation, readiness, serial/parallel rules, and fallback nodes.
- [ ] 1.3 Define solver adapter and deterministic fallback interface.

## 2. Planner Integration

- [ ] 2.1 Run repair after graph search and resource ranking for graph-driven paths.
- [ ] 2.2 Return repaired path artifacts with explicit checkpoint and terminal validation coverage.
- [ ] 2.3 Return structured infeasible reasons when constraints cannot be satisfied.
- [ ] 2.4 Preserve existing path-round persistence and terminal validation semantics.

## 3. Verification

- [ ] 3.1 Add tests for time budget repair.
- [ ] 3.2 Add tests for required checkpoint and terminal validation insertion.
- [ ] 3.3 Add tests for infeasible missing terminal validation and locked heavy-node fallback.
- [ ] 3.4 Run `rtk openspec validate cpsat-path-repair-and-checkpoints --strict`.
