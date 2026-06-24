## Why

Virtual simulation pages currently mix fixed scene styling, dark control cards, and weak light-mode parity. The platform needs explicit light and dark simulation templates so catalog, mission workspace, local panels, and learning tasks feel premium and coherent in both modes.

## What Changes

- Define light and dark templates for simulation catalog, `SimulationShell`, local panels, bottom toolbar, hints, and learning mission surfaces.
- Map simulation surfaces to platform and commercial brand tokens rather than page-local palettes.
- Require translucent shell chrome in both themes while preserving text contrast and scene readability.
- Define visual states for status, warning, success, danger, evidence, replay, preview, and official context.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `platform-commercial-brand-language`: define simulation-specific light/dark visual expression under the Instrument Atlas thesis.
- `platform-design-system-and-shell`: require simulation shells to consume governed theme roles.
- `commercial-workspace-surface-system`: define theme behavior for simulation workspace panels and tools.

## Impact

- Affects simulation CSS/token usage, shell surfaces, panel backgrounds, toolbar styling, status colors, visual evidence, and route templates.
- Does not change logo, 3D model assets, or simulation algorithms.
