## Why

Simulation and Arena data already exist in `SimulationSession`, `SimulationLog`, `ArenaBlackBoxExperiment`, `ArenaVirtualSimulationRun`, `ArenaSubmission`, `ArenaEvaluationRun`, and `LearningFact`, but the governance catalog does not treat them as one evidence chain. This prevents reliable reporting, traceability, and adaptive-learning consumption.

## What Changes

- Define simulation and Arena evidence sources as a governed source family.
- Add readiness semantics for sessions, logs, public experiments, virtual previews, official submissions, official evaluations, and materialized learning facts.
- Define how compact summaries and trace references enter `LearningFact.contextJson`.
- Preserve high-frequency traces outside `LearningFact`.

## Capabilities

### New Capabilities
- `simulation-arena-evidence-governance`: Governs simulation and Arena source coverage, materialization, trace references, and LearningFact summaries.

### Modified Capabilities
- `learning-evidence-source-catalog`: Extend the existing catalog with `SimulationSession`, `ArenaBlackBoxExperiment`, and `ArenaVirtualSimulationRun` rather than creating a second source catalog.
- `arena-learning-evidence-context`: Preserve simulation/Arena run, trace, protocol, and governance context in learning facts and class insight aggregation.

## Impact

- Affects `src/lib/data-governance/**`, admin governance status, Arena persistence, and future simulation trace persistence.
- Depends on `standardize-simulation-scene-and-trace-protocol`.
- Does not implement Feature Store or recommendation consumers; that is covered by `materialize-simulation-features-for-personalization`.
