## ADDED Requirements

### Requirement: Mission workspaces prioritize instrument area
Commercial mission workspaces SHALL prioritize active object, current step, primary command, and instrument area before explanatory or configuration content.

#### Scenario: Mission workspace first viewport renders
- **WHEN** Control Workbench, Arena task, simulation, or lesson runtime workspace opens
- **THEN** the first viewport SHALL expose current context, primary task state, and the main visualization or instrument entry
- **AND** long process explanations, secondary panel setup, and support text SHALL NOT obscure the primary instrument area.

### Requirement: Lesson runtime workspaces preserve runtime manifest truth
Commercial lesson runtime workspaces SHALL preserve the runtime lesson manifest and teacher/student activity contract.

#### Scenario: Runtime lesson shell is redesigned
- **WHEN** a lesson has `interactive-manifest.json` or equivalent runtime bundle
- **THEN** the UI SHALL consume runtime truth for steps, activities, telemetry summary, teacher insight, and teacher controls
- **AND** redesign SHALL NOT replace runtime state with static decorative panels or authoring-only assumptions.

### Requirement: Mobile mission workspaces use sheets for secondary controls
Commercial mission workspaces SHALL use mobile sheets or drawers for secondary configuration.

#### Scenario: Workspace renders at 320px width
- **WHEN** object selection, method boundaries, filters, panel setup, evidence, or support content is available
- **THEN** secondary content SHALL move into explicit sheet/drawer controls
- **AND** the primary visualization or task entry SHALL remain reachable without reading through all secondary panels.
