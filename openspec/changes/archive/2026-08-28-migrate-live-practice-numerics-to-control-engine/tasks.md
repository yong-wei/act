## 1. Baseline and migration matrix

- [x] 1.1 Verify R1/R2 identities and clean source revision; freeze seven scene clocks (`1/60,120`), Control Odyssey clock (`1/60,6`), routes/APIs, models, writers, scripts, tests, and direct/dynamic callers.
- [x] 1.2 Inventory and classify plant integration, controller, disturbance/environment, metrics, state adapters, UI, and telemetry paths; freeze PID/Smith/DP/thruster/notch/gain-schedule/wind/current/ice/sloshing/RK4 denominator.
- [x] 1.3 Build the per-model Rust capability, request/result, protocol/runtime/model identity, actual `executor`/`authoritySource`, baseline, property, abs/rel tolerance, and rollback matrix.

## 2. Cruise vertical slice

- [x] 2.1 Freeze Cruise live turn baseline for fixed-step state, controller output, disturbance state, summary metrics, seed, and checksum.
- [x] 2.2 Implement the Rust/facade phase path for Cruise plant, controller, disturbance, and metrics without changing the Practice run contract.
- [x] 2.3 Connect `cruise-simulation.tsx` and telemetry bridge to `SimulationClock` plus client facade; pause/reset safely while WASM is unavailable.
- [x] 2.4 Keep browser/worker facade output display-only; persist only Practice-owned `SimulationRun`/`SimulationTrace` through the trusted writer with validated executor/authority source, and verify no Arena submission/evaluation/leaderboard side effect.

## 3. Remaining live numerics

- [x] 3.1 Migrate container, destroyer, dredger, drilling, icebreaker, and LNG scene plant/controller paths one model family at a time.
- [x] 3.2 Migrate Control Odyssey live/runtime paths while preserving its `dt=1/60,maxSubSteps=6`, phase semantics, and `phaseCrossoverStatus` contract.
- [x] 3.3 Replace each identified PID, Smith, DP, thruster, notch, gain-schedule, wind/current, ice, sloshing, and RK4 numeric implementation with a registered Rust capability or mark it unavailable until supported.
- [x] 3.4 Preserve scene-specific `dt/maxSubSteps`, units, record cadence, summary metric denominators, seed, and replay checksum; do not add variable-delta or setInterval stepping.

## 4. No-facade proof and verification

- [x] 4.1 Add static guards proving active Practice/scene callers do not import old TS steppers or generated WASM directly and every retained compatibility caller has an R6 deletion condition.
- [x] 4.2 Add Rust property/baseline/abs-rel tolerance/benchmark tests for phase boundaries, finite values, constraints, fixed-step invariants, and seeded replay without full-array exact snapshots.
- [x] 4.3 Add browser and server tests for clock pause/reset, per-scene profiles, runtime unavailable, display-only executor/authority source, trusted owner/visibility persistence, replay metadata, and Arena isolation.
- [x] 4.4 Run affected simulation/interactive/Control Odyssey tests, Rust/WASM build, typecheck, relevant lint, strict OpenSpec validation, and `git diff --check`.

## 5. Handoff and rollback

- [x] 5.1 Publish model replacement matrix, caller zero report, baseline/tolerance receipts, and outstanding unsupported capabilities to R6.
- [x] 5.2 Record scene/model rollback commits and confirm no Prisma/persistence deletion, manifest/plugin registry change, Arena scoring change, deployment, or selector mutation.
