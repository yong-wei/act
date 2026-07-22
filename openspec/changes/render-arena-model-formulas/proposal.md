## Why

The Arena challenge detail renders transfer functions with KaTeX, but the model selector still prints the plain `display` string. As a result, expressions such as `s^2` appear as source notation instead of professional mathematical typography while students compare or confirm models.

## What Changes

- Render transfer functions in both locked-model and selectable-model states with inline KaTeX.
- Prefer the existing model `latex` value and retain the plain `display` value as a fallback.
- Add focused component coverage for superscript rendering, fallback text, and model selection behavior.

## Capabilities

### New Capabilities
- `arena-model-formula-rendering`: Defines professional transfer-function rendering in Arena model selection surfaces.

### Modified Capabilities

None.

## Impact

- Affects `src/features/arena/workbench/arena-model-selector-panel.tsx` and a focused Arena component test.
- Reuses the existing `react-katex` and KaTeX dependencies.
- Does not change transfer-function data, model selection rules, evaluation logic, persistence, or APIs.
