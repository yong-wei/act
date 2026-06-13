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

#### Scenario: Simulation pages expose local tools as workspace controls
- **WHEN** a simulation detail route renders local telemetry, controls, hints, or scene commands
- **THEN** the controls SHALL be organized as simulation-local workspace panels and bottom tools
- **AND** mobile secondary controls SHALL NOT appear as persistent sidebars that compete with the primary scene
- **AND** the local tool layer SHALL use governed platform tokens rather than page-local palettes.

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

### Requirement: Workspace shell supports collapsible navigation
The system SHALL provide a unified workspace shell pattern for dense student workspaces with desktop expanded navigation, desktop collapsed navigation, sticky breadcrumb header, personal-center account action, and mobile drawer navigation.

#### Scenario: Desktop workspace shell expands and collapses
- **WHEN** a student opens a migrated workspace on a desktop-width viewport
- **THEN** the left navigation SHALL be available in expanded and collapsed states
- **AND** the collapsed state SHALL preserve route navigation through icons, accessible names, focus order, and active route indication
- **AND** the collapsed state SHALL reserve only the approved narrow navigation rail width rather than the expanded sidebar width
- **AND** collapsed navigation items SHALL NOT display duplicated or ambiguous abbreviated text
- **AND** the main workspace area SHALL expand without horizontal overflow.

#### Scenario: Mobile workspace shell uses a drawer
- **WHEN** a student opens a migrated workspace at 320px width
- **THEN** global workspace navigation SHALL move into an explicit drawer or sheet control
- **AND** the primary task content SHALL remain reachable without reading through all navigation entries.

### Requirement: Workspace visual assets are centralized
The system SHALL keep generated or hand-authored visual-world assets for workspace identity in a centralized platform asset directory rather than page-local route folders.

#### Scenario: Arena visual assets are added
- **WHEN** Arena shell, entry, empty-state, or challenge-card visuals require images or domain illustrations
- **THEN** those assets SHALL be stored under a single platform visual-world directory for Arena
- **AND** page components SHALL reference those assets through a consistent path or manifest
- **AND** the assets SHALL NOT be scattered inside Arena route, component, or test fixture directories.

#### Scenario: Visual assets render with UI text
- **WHEN** a generated image or illustration is used in the workspace shell or Arena cards
- **THEN** the asset SHALL NOT contain rendered instructional text, labels, or numbers that are needed for comprehension
- **AND** readable text SHALL be rendered by the application UI.

### Requirement: Workspace identity avoids emoji symbols
The system SHALL use the platform icon system, shared status semantics, and centralized visual assets for premium workspace identity instead of emoji-style symbols.

#### Scenario: Workspace navigation and cards render
- **WHEN** a migrated workspace displays navigation, route identity, task status, empty states, or primary actions
- **THEN** the UI SHALL use consistent icons, text, status markers, or centralized visual assets
- **AND** it SHALL NOT use emoji as functional module symbols, status symbols, or premium visual identity.

### Requirement: Workspace zones are available through AppShell
Commercial workspace zones SHALL be expressible through the shared AppShell contract when a route declares a dense workspace archetype.

#### Scenario: Mission workspace renders
- **WHEN** a Control Workbench, Arena task, simulation, or interactive runtime route uses the `mission-workspace` archetype
- **THEN** AppShell SHALL support context header, command bar, instrument area, evidence rail, support drawer, status rail, and local tool slots
- **AND** feature content SHALL not need a separate page shell to express those zones.

#### Scenario: Simulation detail route renders
- **WHEN** a `/simulations/*` detail route renders through the shared simulation shell
- **THEN** it SHALL expose route-level breadcrumbs, theme switching, personal-center access, return target metadata, and the primary simulation scene as the main instrument area
- **AND** the shell SHALL NOT compute physics state, controller state, telemetry truth, or Arena official evaluation truth.

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

### Requirement: Report-ledger surfaces preserve evidence and export readability
Commercial report-ledger surfaces SHALL prioritize evidence review, source labels, privacy boundaries, status filtering, and export readiness.

#### Scenario: Report-ledger route or component is migrated
- **WHEN** grading, teacher report, governance snapshot, prep-pack review, assistant effect report, or export UI is migrated
- **THEN** the surface SHALL show source labels, privacy labels, review status, export actions, and key metrics in a readable hierarchy
- **AND** unavailable data SHALL be represented as honest status rather than generated-looking placeholder output.

### Requirement: Runtime overlay and effect reports fit operations/report shells
Future runtime overlay and assistant effect report capabilities SHALL use operations-console or report-ledger slots instead of standalone local shells.

#### Scenario: Overlay or effect report capability becomes available
- **WHEN** overlay preview/review/activate/archive/rollback or deterministic demo/effect report data is displayed
- **THEN** it SHALL use unified shell navigation, evidence/status semantics, privacy boundaries, and export/readiness controls
- **AND** it SHALL not mutate base runtime manifests or fabricate effect metrics in presentation code.

### Requirement: Knowledge map local panels are workspace controls
Knowledge graph chapter directories, relation filters, legends, view toggles, and node resource panels SHALL render as local workspace controls rather than platform navigation.

#### Scenario: Knowledge graph renders on desktop
- **WHEN** `/knowledge` renders at a desktop viewport
- **THEN** AppShell SHALL provide the platform route navigation and route trace
- **AND** graph-specific chapter directories and filters SHALL be visually subordinate local panels using platform tokens
- **AND** local graph panels SHALL NOT duplicate or visually compete with platform navigation.

#### Scenario: Knowledge graph renders on mobile
- **WHEN** `/knowledge` renders at 320px width
- **THEN** graph-specific directories, filters, and legends SHALL move into explicit drawer, sheet, tab, or command surfaces
- **AND** the graph canvas or primary graph task SHALL remain reachable without reading through a fixed desktop sidebar.

#### Scenario: Graph data marks need domain colors
- **WHEN** relation edges, node categories, or graph density states need color encoding
- **THEN** those colors SHALL be treated as chart or graph data marks
- **AND** shell, panel, filter, and navigation surfaces SHALL use platform semantic tokens rather than route-local raw palette values.

