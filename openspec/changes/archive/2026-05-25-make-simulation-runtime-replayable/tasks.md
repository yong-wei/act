## 1. Seeded Runtime Context

- [x] 1.1 Add deterministic RNG and scoped stream utilities.
- [x] 1.2 Add `SimulationRunContext` fields for seed, versions, scenario, and protocol.
- [x] 1.3 Thread the context through trace-producing simulation boundaries.

## 2. Randomness Migration

- [x] 2.1 Replace evidence-bearing disturbance `Math.random()` calls with seeded RNG.
- [x] 2.2 Replace optimizer and Arena adapter randomness that affects persisted datasets or previews.
- [x] 2.3 Leave visual-only randomness untouched unless it affects telemetry or scoring.

## 3. Verification

- [x] 3.1 Add deterministic replay tests for same seed and same input.
- [x] 3.2 Add changed-seed tests for at least one stochastic path.
- [x] 3.3 Add Replay Service/API tests for run lookup, checksum match, checksum mismatch, missing trace, and unauthorized access.
- [x] 3.4 Run `rtk proxy openspec validate make-simulation-runtime-replayable --strict`.
