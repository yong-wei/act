## Why

Simulation validation and ship-ocean transfer goals currently have no path-eligible resources in the baseline matrix even though related simulations, workbench tasks, Arena resources, and transfer materials exist.

## What Changes

- Cover simulation-validation-practice and ship-ocean-transfer-application target graph nodes.
- Review simulation, control workbench, Arena preview, terminal-validation, reflection, and transfer-application resources.
- Preserve official Arena scoring boundaries and preview/official distinction.

## Impact

- Adds a staged resource-completion batch under `resource-path-readiness`.
- Requires helper before/after evidence and independent review before downstream gates can rely on the result.
- May update resource governance data, helper output, tests, and spec deltas within this change boundary.
