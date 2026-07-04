## Tasks

- [ ] Task 1: Generate simulation/transfer worklist.
  Covers: AC-1
  Acceptance: Worklist targets simulation, workbench, Arena, reflection, and transfer application resources.
  Evidence: helper workqueue output.
  Reviewer Check: Confirm official and preview evidence families are separated.

- [ ] Task 2: Manually review high-complexity graph bindings.
  Covers: AC-1, AC-2
  Acceptance: Bindings include readiness, evidence authority, and limitation rationale.
  Evidence: source diff and audit output.
  Reviewer Check: Confirm official Arena authority is not inferred from preview resources.

- [ ] Task 3: Validate simulation and transfer baseline coverage.
  Covers: AC-3
  Acceptance: Baseline matrix shows reviewed coverage or precise limitations for simulation and ship-ocean goals.
  Evidence: baseline matrix diff.
  Reviewer Check: Confirm remaining gaps are actionable.

## Validation

- [ ] Run `rtk openspec validate complete-simulation-transfer-graph-bindings --strict`.
- [ ] Run the helper or targeted tests named in the task evidence.
- [ ] Preserve before/after helper output for independent review.
