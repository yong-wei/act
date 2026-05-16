## Why

The classic four-view workbench currently renders fixed chart contents. A unified workbench needs view-level configuration so different methods can expose valid signals without showing fake or misleading data.

## What Changes

- Add a workbench view registry and per-view availability checks.
- Add configuration menus for time-domain, Bode, root-locus, and Nyquist views.
- Persist view configuration in local session state for the current workbench session.
- Disable unsupported signals and views with Chinese explanations.

## Capabilities

### New Capabilities
- `control-workbench-view-configuration`: Defines configurable view plugins, supported signal selection, and unavailable-state behavior for workbench charts.

### Modified Capabilities

## Impact

- Adds files under `src/features/control-workbench/views/`.
- Reuses existing chart panels in `src/resources/control-system/charts/control-analysis-panels.tsx`.
- No backend or evaluator changes.
