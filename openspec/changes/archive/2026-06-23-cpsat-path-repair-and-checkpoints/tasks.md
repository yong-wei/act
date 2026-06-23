## 1. Repair Contract

- [x] 1.1 Define repair input/output payloads for draft path, bounded alternatives, constraints, version refs, and limitations.
- [x] 1.2 Define constraint types for prerequisites, time budget, checkpoints, terminal validation, readiness, serial/parallel rules, and fallback nodes.
- [x] 1.3 Define solver adapter and deterministic fallback interface.

## 2. Planner Integration

- [x] 2.1 Run repair after graph search and resource ranking for graph-driven paths.
- [x] 2.2 Return repaired path artifacts with explicit checkpoint and terminal validation coverage.
- [x] 2.3 Return structured infeasible reasons when constraints cannot be satisfied.
- [x] 2.4 Preserve existing path-round persistence and terminal validation semantics.

## 3. Verification

- [x] 3.1 Add tests for time budget repair.
- [x] 3.2 Add tests for required checkpoint and terminal validation insertion.
- [x] 3.3 Add tests for infeasible missing terminal validation and locked heavy-node fallback.
- [x] 3.4 Run `rtk openspec validate cpsat-path-repair-and-checkpoints --strict`.
