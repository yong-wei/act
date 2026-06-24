## 1. Goal Contract

- [x] 1.1 Define the canonical `control-correction` goal id and target-level vocabulary.
- [x] 1.2 Define the required dimension ids and payload fields for learner-state projection.
- [x] 1.3 Map each dimension to governed evidence families and confidence states.
- [x] 1.4 Document privacy classes for student, teacher, admin, audit, and internal field families.

## 2. Implementation

- [x] 2.1 Extend learner-state service contracts or DTOs to expose the goal slice without replacing existing learner-state payloads.
- [x] 2.2 Add deterministic fixtures for complete, partial, stale, and missing evidence.
- [x] 2.3 Add fallback markers for dimensions that have insufficient source coverage.

## 3. Verification

- [x] 3.1 Add focused unit tests for goal-slice assembly and confidence markers.
- [x] 3.2 Add contract tests that reject payloads missing privacy or confidence metadata.
- [x] 3.3 Verify no downstream payload exposes raw answer bodies, raw dialogue, hidden Arena internals, or raw simulation traces.
- [x] 3.4 Run `rtk openspec validate define-control-correction-goal-slice --strict`.
- [x] 3.5 Run the minimal learner-state or data-governance test suite that covers the modified service boundary.
