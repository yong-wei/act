## Why

Arena black-box preview already persists dataset, registered model, controller hash, trace, summary, and replay metadata. Platform consumers still need a canonical SimulationRun reference so preview evidence can be audited, replayed, compared, and materialized without treating preview as official evaluation.

## What Changes

- Keep `ArenaVirtualSimulationRun` as the Arena preview detail record.
- Add a required mapping from each Arena preview detail record to a canonical `SimulationRun`.
- Require normal platform consumers to read the SimulationRun envelope while Arena-specific pages may read the detail table.
- Preserve preview versus official boundaries through run kind, model relation, visibility, and official eligibility metadata.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `arena-model-registry-preview-adapters`: Requires Arena preview runs to map to canonical SimulationRun while retaining Arena detail fields.
- `simulation-arena-evidence-governance`: Defines how Arena preview run envelopes participate in governed simulation evidence without becoming official evaluation.

## Impact

- Depends on `standardize-simulation-task-run-contract`.
- Affects Arena black-box preview services, replay verification, Arena preview APIs, data governance status, and future LearningFact materialization.
