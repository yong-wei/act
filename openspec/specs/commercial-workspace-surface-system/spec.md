## Purpose
Define commercial workspace layout, panel, command, evidence, and chart-surface rules for dense learning, simulation, challenge, course-runtime, teacher, and admin tools.
## Requirements
### Requirement: Commercial workspaces use instrument-oriented zones
The system SHALL structure dense workspaces with context strip, command bar, instrument area, evidence rail, and support drawer zones when those zones apply to the workspace.

#### Scenario: A dense workspace renders
- **WHEN** Control Workbench, Arena challenge detail, interactive course runtime, simulation workspace, teacher analytics, or admin governance renders a dense task surface
- **THEN** the surface SHALL expose task context, primary commands, instrument panels, evidence/status context, and support actions through a coherent commercial hierarchy
- **AND** it SHALL NOT rely on unrelated nested cards as the primary layout model.

### Requirement: Workspace panels preserve stable visual geometry
The system SHALL keep chart, diagram, media, and module panel wrappers dimensionally stable while controls, loading state, availability, and selected series change.

#### Scenario: A student changes a panel option
- **WHEN** the student switches curves, object, method, lesson step, answer state, or evidence overlay
- **THEN** the panel wrapper SHALL preserve stable width and height constraints
- **AND** surrounding panels SHALL NOT jump because option controls or fallback text changed.

### Requirement: Workspaces may replace legacy local shells
The system SHALL allow workspace-specific commercial shells to replace local page shells when the replacement preserves route behavior, role actions, and contextual navigation.

#### Scenario: A legacy workspace shell conflicts with commercial hierarchy
- **WHEN** a workspace shell duplicates global navigation, hides contextual route state, or forces a generic card layout
- **THEN** the migration MAY replace it with a commercial workspace shell derived from shared brand and navigation tokens.

### Requirement: Workspace presentation preserves domain ownership
The system SHALL keep commercial workspace primitives display-focused and SHALL NOT compute domain truth for simulations, official evaluation, learner evidence, module correctness, or route authorization.

#### Scenario: Workspace renders evidence or panel availability
- **WHEN** a workspace panel displays readiness, official status, confidence, correct/incorrect state, or availability
- **THEN** the feature domain SHALL supply that state
- **AND** the commercial surface primitive SHALL only map it to layout, tone, label, and allowed details.

### Requirement: Operations workspaces share the commercial system
The system SHALL treat teacher analytics, admin governance, data center, data-quality, and report surfaces as first-class commercial operations workspaces.

#### Scenario: Teacher or admin opens an operations workspace
- **WHEN** a teacher analytics, admin governance, data center, data-quality, or report surface renders
- **THEN** it SHALL use the shared commercial workspace concepts for context, commands, instruments, evidence/status, and support actions
- **AND** it SHALL preserve dense repeated-use ergonomics rather than copying spacious student-entry layouts.

### Requirement: Operations metrics use stable commercial hierarchy
Operations workspaces SHALL align metrics, tables, status summaries, filters, and report actions through stable visual hierarchy and tabular numeric treatment.

#### Scenario: A teacher or admin page displays operational metrics
- **WHEN** the page renders class, learner, evidence, queue, report, or governance metrics
- **THEN** numeric values SHALL align consistently
- **AND** status and confidence labels SHALL use shared evidence semantics rather than page-local badge vocabularies.

### Requirement: Task workspaces use registered archetypes
Commercial workspaces SHALL support registered archetypes for immersive scene, engineering analysis, challenge task, lesson runtime, learner data, operations analytics, and governance console surfaces.

#### Scenario: A task route is migrated
- **WHEN** a simulation, Control Workbench, Arena, or interactive runtime route adopts a commercial workspace
- **THEN** it SHALL declare its workspace archetype and expected zones
- **AND** it SHALL inherit platform tokens, navigation conventions, account actions, and floating dock rules.

### Requirement: Dense workspace controls do not compete with shell controls
Commercial workspace local controls SHALL be visually distinct from role cockpit, global navigation, and floating dock controls.

#### Scenario: A workspace has local tools and shell actions
- **WHEN** camera tools, chart toggles, parameter controls, Konling, and settings are all available
- **THEN** their location and priority SHALL make task-local tools distinct from shell-level floating controls
- **AND** keyboard focus order SHALL remain coherent.

