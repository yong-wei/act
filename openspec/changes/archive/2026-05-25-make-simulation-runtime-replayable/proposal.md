## Why

The current simulation stack uses fixed-step runtime rules, but evidence-bearing stochastic paths still use implicit randomness in disturbances, optimizer sampling, and some Arena adapter behavior. That prevents reliable replay, fair comparison, and auditable learning evidence.

## What Changes

- Route simulation-domain randomness through a seedable run context.
- Add runtime/model/seed/checksum replay metadata to trace-producing boundaries.
- Add a Replay Service/API contract for teacher review, competition appeals, and reproducibility checks over persisted trace references.
- Cover environment disturbance and Arena experiment/preview paths that affect scoring, telemetry, or evidence.
- Add deterministic replay verification for same seed and same input.

## Capabilities

### New Capabilities
- `simulation-runtime-replayability`: Defines deterministic seed, RNG, version, and checksum behavior for simulation runs.

### Modified Capabilities
- None.

## Impact

- Affects `src/resources/simulations/physics/disturbances/**`, `src/resources/simulations/lib/monte-carlo-optimizer.ts`, Arena adapters, and trace-producing runtime boundaries.
- Requires the protocol from `standardize-simulation-scene-and-trace-protocol`.
- Validation gate is `rtk proxy openspec validate make-simulation-runtime-replayable --strict`.
