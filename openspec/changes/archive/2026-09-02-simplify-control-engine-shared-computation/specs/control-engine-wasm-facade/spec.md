## ADDED Requirements

### Requirement: Shared control-engine simplification is behavior- and evidence-preserving
After analysis/controller and simulation/metrics moduleization is complete, shared numerical computation MAY be simplified only when `code-simplification` has been actively applied to a canonical implementation and a revision-bound before/after record proves unchanged outputs, errors, side effects/order, public exports/ABI, finite/constraint behavior, replay/checksum identity and declared tolerance. Pure file moves, renames, formatting or forwarding wrappers SHALL NOT qualify as simplification.

#### Scenario: Equivalent shared computation is simplified
- **WHEN** a candidate shared computation has characterization coverage and `code-simplification` confirms the after implementation is clearer
- **THEN** the change SHALL record before/after bytes/lines, symbols, exports, fixtures, errors, tolerance, tests and rollback commit
- **AND** the numerical result and authority boundaries SHALL remain unchanged.

#### Scenario: A proposed simplification changes behavior or clarity
- **WHEN** outputs, error semantics, side effects/order, tolerance, ABI or comprehension worsens, or the proposal only moves files
- **THEN** the block SHALL be rejected or reverted
- **AND** it SHALL not be counted toward C27 completion.

### Requirement: Simplification preserves numerical and evaluation authorities
Shared computation simplification SHALL preserve Rust/WASM as the numerical source of truth, the existing client/worker/server WASM facade, fixed-step scheduling, Practice/preview non-official visibility, server-side Arena official evaluation and the existing Artifact/Run contract. It SHALL not remove a unique numerical safety validator or introduce a fallback authority.

#### Scenario: Practice or preview uses simplified computation
- **WHEN** a Practice or browser/worker preview invokes a simplified shared computation
- **THEN** it SHALL retain fixed-step, non-official, non-persistent display semantics and existing model/protocol/checksum identity
- **AND** it SHALL not become an Arena official score or leaderboard input.

#### Scenario: Arena official evaluation uses shared computation
- **WHEN** the server Arena evaluator invokes a simplified Rust capability
- **THEN** hidden inputs, task/protocol selection, metric extraction, hard constraints, score, validity and persistence SHALL remain under Arena server authority
- **AND** the browser result or simplification metadata SHALL not override that authority.
