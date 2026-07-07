## Tasks

- [x] Task 1: Generate simulation/transfer worklist.
  Covers: AC-1
  Acceptance: Worklist targets simulation, workbench, Arena, reflection, and transfer application resources.
  Evidence: helper workqueue output and `evidence/simulation-transfer-graph-bindings.md`.
  Reviewer Check: Confirm official and preview evidence families are separated.

- [x] Task 2: Manually review high-complexity graph bindings.
  Covers: AC-1, AC-2
  Acceptance: Bindings include readiness, evidence authority, and limitation rationale.
  Evidence: source diff, audit output, and `evidence/simulation-transfer-graph-bindings.md`.
  Reviewer Check: Confirm official Arena authority is not inferred from preview resources.

- [x] Task 3: Validate simulation and transfer baseline coverage.
  Covers: AC-3
  Acceptance: Baseline matrix shows reviewed coverage or precise limitations for simulation and ship-ocean goals.
  Evidence: baseline matrix diff and `evidence/simulation-transfer-graph-bindings.md`.
  Reviewer Check: Confirm remaining gaps are actionable.

## Validation

- [x] Run `rtk openspec validate complete-simulation-transfer-graph-bindings --strict`.
- [x] Run the helper or targeted tests named in the task evidence.
- [x] Preserve before/after helper output for independent review.
