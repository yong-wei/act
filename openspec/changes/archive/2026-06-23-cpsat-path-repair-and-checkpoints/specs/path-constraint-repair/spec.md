## ADDED Requirements

### Requirement: Path repair is bounded and explainable
The system SHALL repair graph-driven draft paths using bounded candidate sets and explicit constraint output.

#### Scenario: Draft path violates constraints
- **WHEN** a graph-driven draft path exceeds time budget, lacks required checkpoints, misses terminal validation, violates hard prerequisites, or includes locked nodes without readiness evidence
- **THEN** the repair stage SHALL attempt to produce a repaired path from the bounded candidate and fallback set
- **AND** the output SHALL identify repaired constraints, inserted or removed nodes, tradeoffs, limitations, and version refs.

#### Scenario: Repair is infeasible
- **WHEN** no bounded candidate set can satisfy hard prerequisites, checkpoint policy, terminal validation policy, readiness policy, or time budget
- **THEN** the repair stage SHALL return structured infeasible reasons
- **AND** the planner SHALL expose a low-resource, low-confidence, or budget-expansion fallback instead of silently emitting an invalid path.

### Requirement: Solver dependency is abstracted
The path repair layer SHALL use a solver adapter boundary and deterministic fallback.

#### Scenario: Solver is unavailable
- **WHEN** a CP-SAT, ILP, Z3, WASM, or external solver adapter is unavailable or disabled
- **THEN** the system SHALL use deterministic bounded repair or return governed infeasible output
- **AND** path generation SHALL NOT require a solver to produce feasible Stage 1 starter paths.

### Requirement: Checkpoint and terminal validation coverage is explicit
Repaired paths SHALL make checkpoint and terminal validation policy satisfaction visible.

#### Scenario: Repaired path is returned
- **WHEN** repair succeeds
- **THEN** the path artifact SHALL identify checkpoint nodes, terminal validation nodes, validation source type, readiness requirements, and any preview-only or missing-official limitations
- **AND** preview evidence SHALL NOT be represented as official terminal validation unless policy explicitly allows it.
