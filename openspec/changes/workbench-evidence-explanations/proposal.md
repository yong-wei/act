## Why

Workbench views currently answer which curves to show. Arena Pro requires views to help students explain design evidence: what a curve indicates, which trade-off it exposes, and what action it suggests.

## What Changes

- Add an explanation layer for workbench views.
- Provide diagnostic messages for time-domain, Bode, root-locus, response comparison, control effort, metric summary, and black-box identification contexts.
- Connect explanations to the design flow without changing official evaluation.

## Capabilities

### New Capabilities

- `workbench-evidence-explanations`

### Modified Capabilities

- None.

## Impact

- `src/features/control-workbench/views/index.ts`
- Workbench view rendering components
- `src/features/control-workbench/presets/*`
- Explanation helper tests
