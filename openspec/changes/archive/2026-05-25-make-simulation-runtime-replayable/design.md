## Context

`docs/Simulation_Guidelines.md` already requires fixed-step execution. The remaining reproducibility gap is stochastic behavior outside the runtime clock. Current source evidence includes implicit `Math.random()` in current/wind disturbances, dredging impact, Monte Carlo sampling, and test/mock Arena adapters.

## Goals

- Make evidence-bearing simulation randomness deterministic under an explicit seed.
- Make replay metadata visible at request/response and trace boundaries.
- Preserve current physics semantics where possible; only replace random source ownership.

## Non-Goals

- No full physics rewrite.
- No visual-only particle randomness migration unless it enters telemetry, scoring, or evidence.
- No official Arena scoring change except metadata and determinism.

## Design

Introduce a small deterministic RNG abstraction that can be built from a run seed and scoped stream name. Runtime callers should pass a `SimulationRunContext` containing `runId`, `sceneId`, `scenarioId`, `seed`, `protocolVersion`, `runtimeVersion`, and `modelVersion`.

Disturbance and optimizer functions that currently call `Math.random()` should accept an RNG parameter or derive one from the run context. This includes current/wind variation, dredging impacts, optimizer candidate generation, and any Arena adapter path that contributes to persisted datasets or previews.

Replay checksums should be computed from normalized trace summaries and metadata, not raw object insertion order. Tests should assert that same seed/input produces the same summary/checksum and that changed seed changes at least one stochastic output in a covered path.

The Replay Service should accept a run id or trace reference, resolve the matching `SceneSpec`, `EvaluationSpec`, controller artifact, seed, runtime version, and model version, rerun or verify the normalized summary, and compare the resulting checksum. Access must be scoped: teachers can review class/course runs they own, students can inspect their own runs where policy permits, and appeal/review workflows must avoid exposing hidden official evaluation internals.

## Risks

- Changing random sources can alter historical behavior. The implementation should prefer compatibility-preserving seeded defaults for existing standalone launches.
- Floating-point output can vary across runtimes. Checksums should target normalized summary and sample data with explicit rounding.

## Verification

- Unit tests for RNG determinism and scoped streams.
- Replay tests for at least one disturbance path and one Arena experiment or preview path.
- Service/API tests for replay success, checksum mismatch, missing trace reference, and unauthorized access.
- Existing lint/test/build commands according to touched implementation scope.
