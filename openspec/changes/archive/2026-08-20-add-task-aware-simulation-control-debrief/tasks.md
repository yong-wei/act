## 1. Debrief contract and projector

- [x] 1.1 Add focused failing tests for verified completed-run binding, finite metric availability, measurement semantics, authoritative partial thresholds, free exploration, and forbidden aggregate judgments.
- [x] 1.2 Implement the pure debrief types, Cruise metric registry, fact projection, per-metric threshold comparison, and deterministic learning-observation templates without adding a physics or response-metric calculator.
- [x] 1.3 Add contract tests proving end-of-run heading error is not relabeled as steady-state error and end-of-run rudder/fin power are not represented as peak, energy, or constraint outcomes.

## 2. Cruise completion integration

- [x] 2.1 Make Cruise completion emission require `state.isCompleted`, current run identity, and a validated telemetry summary; add pause-before-completion, reset, repeated-render, and new-run regression tests.
- [x] 2.2 Add the `sim/cruise` / `cruise-comfort-course-turn` adapter that consumes the current run summary and an explicitly proven task-threshold contract while ignoring unproven `targetForm` values and aggregate `summary.passed` for debrief judgment.
- [x] 2.3 Render the “控制效果复盘” card after a supported completed run with separate fact, task-requirement, control-observation, unavailable, and next-observation states.
- [x] 2.4 Verify that rendering, resetting, and rerunning do not mutate telemetry, persisted simulation runs, Arena evaluation/leaderboard data, or learner evidence.

## 3. Acceptance and project verification

- [x] 3.1 Add deterministic component and browser acceptance for: declared thresholds satisfied, overshoot threshold not satisfied, settling-time threshold not satisfied, insufficient control-constraint semantics, and incomplete/invalid run failure closure.
- [x] 3.2 Assert units, threshold provenance, permitted per-metric wording, keyboard/screen-reader structure, and absence of “表现良好”“需要关注”“优秀”“最优” aggregate judgments.
- [ ] 3.3 Run Cruise telemetry bridge and simulation-run persistence regressions, the affected simulation/unit suites, TypeScript, lint, full repository tests, and production build on the final intended revision.
- [x] 3.4 Update `docs/ProjectDescription.md` with the shipped single-scene scope and preserved evaluation/metric authority boundaries.
- [ ] 3.5 Strictly validate the OpenSpec change, complete Buddy review/PR gates, and record implementation evidence without marking Issue acceptance items from the implementation thread.
