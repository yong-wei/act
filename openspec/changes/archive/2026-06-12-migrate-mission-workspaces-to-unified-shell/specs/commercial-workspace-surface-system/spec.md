## ADDED Requirements

### Requirement: Mission workspaces migrate through the unified shell
Primary mission workspaces SHALL migrate to the shared AppShell mission-workspace archetype before local shell styling is considered complete.

#### Scenario: Arena-to-workbench journey is accepted
- **WHEN** a user moves from Arena hall to challenge detail to Control Workbench
- **THEN** the route sequence SHALL preserve context, return target, task state, primary commands, instrument area, evidence/support access, and shell-level dock behavior
- **AND** the pages SHALL not present unrelated local shell systems as competing navigation.

#### Scenario: Mission workspace renders on mobile
- **WHEN** a migrated mission workspace renders at 320px width
- **THEN** secondary controls SHALL move into drawer, sheet, tab, or command surfaces
- **AND** the primary visualization or task entry SHALL remain reachable in the first usable viewport.

### Requirement: Mission migrations preserve domain truth
Mission shell migration SHALL preserve feature-owned truth for Arena, simulation, Control Workbench, and interactive runtime behavior.

#### Scenario: Workspace state is displayed
- **WHEN** official evaluation state, object selection, method availability, lesson runtime step, or evidence status appears in the mission shell
- **THEN** the owning feature domain SHALL supply that state
- **AND** shell primitives SHALL map it only to layout, accessibility, visual tone, and allowed details.
