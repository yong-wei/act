## Why

Dense product workspaces such as Control Workbench, Arena challenge detail, interactive course runtime, and simulation tools contain the platform's strongest value, but the current UI does not consistently present them as high-end commercial instruments. Workspaces need a shared commercial surface model for command hierarchy, panels, charts, evidence, and contextual navigation.

## What Changes

- Define a commercial workspace surface system for dense learning, simulation, challenge, course-runtime, and governance tools.
- Replace card-stacked layouts with instrument surfaces, command bars, context strips, evidence rails, and stable visual panels.
- Require direct-entry and contextual-entry workspaces to initialize complete default panels when the selected object or activity context supports them.
- Apply commercial visual hierarchy to Control Workbench, Arena challenge detail, interactive course runtime modules, and simulation/resource workspaces.
- Treat teacher analytics, admin governance, data center, and report-authoring surfaces as first-class commercial operations workspaces.
- Preserve domain ownership: workspaces render governed data and do not compute learner, evaluation, or simulation truth inside presentation primitives.

## Capabilities

### New Capabilities
- `commercial-workspace-surface-system`: Defines commercial workspace layout, panel, command, evidence, and chart-surface rules.

### Modified Capabilities
- `control-workbench-view-configuration`: Adds commercial panel initialization, stable instrument-panel, and direct-entry requirements.
- `interactive-course-standard-module-migration`: Adds commercial module-chrome requirements for standardized interactive lesson modules.
- `platform-status-and-evidence-ui`: Adds workspace evidence rail and status-placement requirements.

## Impact

- Affects `/interactive-learning/control-workbench`, Arena challenge detail, interactive lesson runtime views, teacher/admin operations surfaces, data governance/report surfaces, shared chart/panel wrappers, status primitives, and workspace shell components.
- Depends on `define-commercial-brand-language` and `refactor-commercial-platform-navigation`.
- Does not redefine student entry pages; those are handled by `redesign-commercial-student-entry-surfaces`.
