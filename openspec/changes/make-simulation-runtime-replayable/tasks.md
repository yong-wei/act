## 1. Seeded Runtime Context

- [ ] 1.1 Add deterministic RNG and scoped stream utilities.
- [ ] 1.2 Add `SimulationRunContext` fields for seed, versions, scenario, and protocol.
- [ ] 1.3 Thread the context through trace-producing simulation boundaries.

## 2. Randomness Migration

- [ ] 2.1 Replace evidence-bearing disturbance `Math.random()` calls with seeded RNG.
- [ ] 2.2 Replace optimizer and Arena adapter randomness that affects persisted datasets or previews.
- [ ] 2.3 Leave visual-only randomness untouched unless it affects telemetry or scoring.

## 3. Verification

- [ ] 3.1 Add deterministic replay tests for same seed and same input.
- [ ] 3.2 Add changed-seed tests for at least one stochastic path.
- [ ] 3.3 Add Replay Service/API tests for run lookup, checksum match, checksum mismatch, missing trace, and unauthorized access.
- [ ] 3.4 Run `rtk proxy openspec validate make-simulation-runtime-replayable --strict`.
