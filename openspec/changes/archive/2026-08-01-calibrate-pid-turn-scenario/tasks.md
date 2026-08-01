## 1. Runtime Actuator Semantics

- [x] 1.1 Add a Rust regression test that submits a `nomoto_quick_sim` request with a 5 degree-per-second rudder limit and a step command, then prove that `maxRudderRate` does not exceed the configured rate.
- [x] 1.2 Run the new Rust test and confirm it fails because the current runtime applies the PID command directly.
- [x] 1.3 Add optional heading-schedule interpolation and optional `maxRudderRateDegPerSec` handling to the Nomoto quick runtime, keeping requests without either field backward compatible.
- [x] 1.4 Re-run the focused Rust test and existing quick-simulation test.

## 2. Calibrated Optimizer Scenario

- [x] 2.1 Add a deterministic TypeScript regression test that evaluates the fixed calibrated PID candidate and requires a score of at least 60, actual rudder rate at most 5 degrees per second, and sustained settling time at most 90 seconds.
- [x] 2.2 Run the TypeScript test and confirm it fails against the current hard-turn, unbounded-actuator scenario.
- [x] 2.3 Define the calibrated heading schedule, origin-aligned guide path, 240-second window, actuator limit, sustained-settling calculation, replay input payload, updated runtime version, and `Kd` upper bound in the optimizer.
- [x] 2.5 Ensure a response that does not remain in the tolerance band receives no settling-score credit.
- [x] 2.4 Re-run the focused TypeScript test and deterministic replay test.

## 3. Verification and Documentation

- [x] 3.1 Run the focused Rust runtime tests and focused simulation replay tests.
- [x] 3.2 Run strict OpenSpec validation for `calibrate-pid-turn-scenario`.
- [x] 3.3 Inspect the diff to verify that Arena official evaluation, leaderboards, task progress, learning evidence, and unrelated Buddy cache files remain untouched.
- [x] 3.4 Bind the evidence route and capture generator to a clean full Git revision, hash the production source and WASM batch, and fail closed on pre/post capture drift.
- [x] 3.5 From the stable code checkpoint, start the bound application instance and regenerate the 1440px/320px evidence as an evidence-only commit.
