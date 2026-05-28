## 1. Experiment Operations

- [x] 1.1 Define experiment variant, assignment health, cohort/stratum, sample count, completeness, and confidence panels.
- [x] 1.2 Define metrics panels for path adoption, deviation, correction success, explanation clicks, intervention acceptance, 48-hour follow-through, learner-state freshness, source coverage, and low-confidence rate.
- [x] 1.3 Define local bandit comparison UI that cannot bypass deterministic feasibility constraints.

## 2. Memory and Bulk Operations

- [x] 2.1 Define long-term semantic memory and strategy memory audit surfaces with restricted raw payload access.
- [x] 2.2 Define teacher bulk ResourceNode mapping, policy review, coverage dashboard, and system-owned issue triage panels.
- [x] 2.3 Define feature-flag and prerequisite-gate behavior for all Stage 2 surfaces.

## 3. Validation

- [x] 3.1 Add tests for Stage 2 gating, privacy-safe exports, aggregation markers, memory redaction, and bulk-operation permissions.
- [x] 3.2 Validate with `rtk proxy openspec validate add-adaptive-experiment-operations-ui --strict`.
