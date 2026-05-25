## 1. Catalog Modeling

- [x] 1.1 Add or refine `learning-evidence-source-catalog` entries for `SimulationSession`, `SimulationLog`, `ArenaBlackBoxExperiment`, `ArenaVirtualSimulationRun`, `ArenaSubmission`, and `ArenaEvaluationRun`.
- [x] 1.2 Define traceability fields, provenance policy, retention class, and readiness for each source.
- [x] 1.3 Ensure admin governance status can report the source family.

## 2. Learning Fact Materialization

- [x] 2.1 Define compact simulation/Arena learning fact context rules in the materialization boundary and related Arena evidence context code.
- [x] 2.2 Preserve trace references and summaries without embedding high-frequency samples.
- [x] 2.3 Add tests for source ids, protocol version, run ids, and governance profile.

## 3. Validation

- [x] 3.1 Run focused data-governance tests for evidence catalog, materialization, and admin status routes touched by this change.
- [x] 3.2 Run `rtk proxy openspec validate govern-simulation-and-arena-evidence-sources --strict`.
