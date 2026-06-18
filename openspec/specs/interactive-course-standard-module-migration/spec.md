## Purpose

Define the migration coverage contract for moving interactive course runtime manifests from legacy or empty module declarations to canonical standard module manifests.
## Requirements
### Requirement: Early lessons use standard modules
The system SHALL migrate lessons 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, and 3-4 to the canonical interactive module taxonomy.

#### Scenario: Early lesson manifests contain canonical modules
- **WHEN** the module registry gate scans 2-1, 2-2, 2-3, 2-4, 3-1, 3-2, 3-3, or 3-4
- **THEN** each visible module SHALL resolve to a canonical module class
- **AND** migrated lessons SHALL NOT rely on lesson-private module kinds.

#### Scenario: Empty early manifests are populated
- **WHEN** an early lesson previously had a runtime manifest with zero modules
- **THEN** the migrated manifest SHALL include standard modules sufficient to render the existing student and teacher page content
- **AND** existing route segments, step ids, and classroom behavior SHALL remain stable.

#### Scenario: Early response evidence remains governed
- **WHEN** a migrated early lesson collects a student response
- **THEN** it SHALL continue to use the shared manifest submission evidence path
- **AND** custom workspace output SHALL be preserved as structured extra evidence rather than mutable state only.

### Requirement: Variant-heavy lessons use standard modules
The system SHALL migrate lessons 3-5, 3-6, 3-7, 3-8, and 3-9 to canonical modules and canonical response contracts.

#### Scenario: One-off variants are removed from migrated manifests
- **WHEN** the module registry gate scans a migrated 3-5, 3-6, 3-7, 3-8, or 3-9 manifest
- **THEN** one-off module kinds such as `derivation-reveal`, `step-reveal-list`, `parametric-workspace`, `frequency-band-labeling`, `phase-peak-locator`, and `scenario-sort-matrix` SHALL NOT appear
- **AND** their behavior SHALL be represented through canonical module classes and fields.

#### Scenario: Compute and workspace behavior remains functional
- **WHEN** a migrated variant-heavy lesson previously used a parameter, root-locus, phase-peak, or other compute workspace
- **THEN** the migrated lesson SHALL preserve the student-facing workflow
- **AND** the output SHALL be captured through a registered compute capability, `activity.workspace`, or structured extra evidence.

#### Scenario: Variant-heavy lessons pass shared gates
- **WHEN** standard module, response, and submission gates run
- **THEN** 3-5, 3-6, 3-7, 3-8, and 3-9 SHALL pass without lesson-private module-kind exceptions.

### Requirement: Stable lesson group uses standard modules
The system SHALL migrate 4-1, 4-2, 4-3, 4-4, 4-5, 4-6, 4-7, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, and cruise-comfort to canonical module classes.

#### Scenario: Stable lessons pass module gates
- **WHEN** standard module gates scan the stable lesson group
- **THEN** every visible module SHALL resolve to a canonical module class
- **AND** migrated lessons SHALL NOT require alias-only course-local registry entries.

#### Scenario: Teacher controls remain stable
- **WHEN** a migrated stable lesson uses teacher release, browse, reveal, answer visibility, or training controls
- **THEN** those controls SHALL preserve current classroom behavior
- **AND** module standardization SHALL NOT remove teacher-controlled visibility semantics.

#### Scenario: Compute panels are capability-bound
- **WHEN** a migrated stable lesson uses rust, interactive figure, analysis, or training panels
- **THEN** the manifest SHALL represent that behavior as `compute.panel`, `activity.workspace`, or an approved standard activity
- **AND** the panel SHALL carry a registered capability reference or an explicit migration exception.

### Requirement: Existing interactive lessons are fully migrated
The system SHALL track every existing runtime-first interactive lesson as migrated to the standard module framework before legacy aliases are removed.

#### Scenario: Full inventory is covered
- **WHEN** the final strict gate runs
- **THEN** the migrated inventory SHALL include all existing runtime-first interactive lessons
- **AND** any missing lesson SHALL fail the gate.

#### Scenario: All migrated lessons pass strict validation
- **WHEN** a migrated lesson is in the inventory
- **THEN** it SHALL pass canonical module, canonical response, submission evidence, and finalization gates
- **AND** it SHALL NOT require a lesson-private module-kind exception.

### Requirement: Standard modules use commercial module chrome
Canonical interactive course modules SHALL render through a commercial module chrome that standardizes title, prompt, activity state, answer state, feedback state, teacher release state, and evidence markers.

#### Scenario: Migrated lesson module renders
- **WHEN** a migrated interactive lesson renders a canonical module such as explanation, reveal, quiz, sort, match, workspace, compute panel, or reflection
- **THEN** the module SHALL use the shared commercial module chrome for state, controls, feedback, and evidence
- **AND** lesson-private visual variants SHALL NOT be used to create one-off module skins.

### Requirement: Course runtime keeps content and platform visual system decoupled
Interactive course content SHALL declare content, activity type, response contract, and capability references, while platform runtime owns commercial module presentation.

#### Scenario: A new course manifest is reviewed
- **WHEN** a course manifest introduces a module
- **THEN** the manifest SHALL reference registered module classes and content fields
- **AND** it SHALL NOT embed page-local styling, private component variants, or unregistered visual skins as course content.

### Requirement: Commercial module chrome is gate-checked
The system SHALL gate migrated interactive lessons against unregistered module kinds and lesson-private module chrome.

#### Scenario: A migrated lesson uses private visual chrome
- **WHEN** a migrated interactive lesson module declares a custom visual skin, unregistered module kind, or lesson-private presentation component
- **THEN** the module registry gate SHALL fail unless a documented temporary migration exception exists
- **AND** the exception SHALL identify the owning migration issue and removal condition.

### Requirement: Code examples use the standard code module
Interactive course manifests SHALL represent visible code examples as `content.code` modules instead of plain rich text or lesson-private renderers.

#### Scenario: MATLAB code example is authored
- **WHEN** an interactive lesson includes a MATLAB-style code example
- **THEN** the manifest SHALL use a `content.code` module with `language` set to `matlab`
- **AND** the payload SHALL include the source code, a teaching title, and a teaching explanation when explanation is needed.

#### Scenario: Code is not a generic prose block
- **WHEN** the module registry gate scans a migrated or new course manifest
- **AND** a visible module carries source-code-like content through an ordinary prose module
- **THEN** the gate SHALL fail or require migration to `content.code`.

### Requirement: Figure-bearing pages use teaching-only visible text
Interactive course pages that display figures, graphics, generated images, or media SHALL expose only teaching-relevant visible text across the entire student-visible and teacher-visible page.

#### Scenario: Figure caption is rendered
- **WHEN** a figure, SVG, generated graphic, or media panel is visible to students or teachers
- **THEN** its visible title, caption, and explanation SHALL describe the teaching object, observable evidence, reading order, or control-system judgment
- **AND** it SHALL NOT display development paths, file paths, module kind names, renderer names, platform implementation notes, or generic labels that only describe the UI carrier.

#### Scenario: Unit 1-1 graphics are reviewed
- **WHEN** Unit 1-1 figure-bearing pages are validated
- **THEN** every visible text string on those pages SHALL be teaching-semantic
- **AND** path-like strings or development labels SHALL fail validation.

### Requirement: Standard interactive modules use registered visual chrome
Standard interactive course module kinds SHALL render through registered shared visual chrome rather than unregistered course-local variants.

#### Scenario: A standard module renders in runtime
- **WHEN** a content, media, formula, table, code, choice, multiple choice, sorting, pairing, drag/match, task, parameter input, graph hotspot, short answer, or assessment module renders
- **THEN** it SHALL use registered shared visual chrome for that module category
- **AND** course-local unregistered chrome SHALL fail acceptance for standard module kinds.

#### Scenario: Teacher controls render for a module
- **WHEN** a teacher releases interaction, pauses answers, progressively reveals content, shows a reference, or reviews submissions
- **THEN** the control SHALL attach to the corresponding interaction module
- **AND** pages with multiple interactions SHALL NOT centralize all module-specific controls in one global side panel.

#### Scenario: Module role and state variants render
- **WHEN** a module is shown in student, guest, teacher, unavailable, submitted, feedback, or reference-visible state
- **THEN** the visual chrome SHALL preserve the role contract and state truth
- **AND** teacher-only states SHALL NOT appear in student or guest views.

### Requirement: Static 3D surfaces use shared standard module rendering
Standard-module interactive lessons SHALL render static 3D surfaces through the shared `compute.panel` runtime path.

#### Scenario: Standard lesson uses a static 3D surface
- **WHEN** a migrated or newly authored standard-module lesson includes a static 3D surface
- **THEN** the manifest SHALL represent it as `kind: compute.panel` with a registered `static-surface-3d` capability
- **AND** it SHALL NOT introduce a lesson-private module kind or visual chrome to render the surface.

#### Scenario: Unit 1-2 pole magnitude surface is migrated
- **WHEN** Unit 1-2 renders the pole magnitude surface in the student or teacher runtime
- **THEN** the surface SHALL be served by the shared static 3D surface panel
- **AND** the existing static image evidence SHALL remain available as fallback or review evidence.

### Requirement: Visual component acceptance artifacts are required
Interactive course implementations SHALL provide a standard acceptance artifact whenever they add or modify visual components or shared control workbench embedding.

#### Scenario: Course visual component is implemented
- **WHEN** a course implementation adds or modifies an interactive visual component
- **THEN** the implementation SHALL record the design contract path, visual source path, teaching mapping, screenshot matrix, viewport matrix, manifest audit path, test result, browser audit path, and backend evidence sample path
- **AND** course completion SHALL fail when the artifact is missing or incomplete.

#### Scenario: Teaching mapping is missing
- **WHEN** a visual component acceptance artifact omits lesson id, step id, learning goal id, handout anchor or evidence unit id, BOPPPS phase, or interactive contract step id
- **THEN** course completion SHALL fail
- **AND** the component SHALL NOT be accepted as serving the lesson design contract.

#### Scenario: Screenshot path is not traceable
- **WHEN** a screenshot artifact path or manifest entry does not identify component id, route, role, theme, viewport, and state
- **THEN** course completion SHALL fail
- **AND** the visual gate SHALL report the missing dimension.

#### Scenario: Component leaks engineering semantics
- **WHEN** visible text in a visual component includes internal module names, renderer names, payload keys, file paths, debug labels, unsupported-module notes, or implementation-only capability ids
- **THEN** the course visual gate SHALL fail
- **AND** the finding SHALL be treated as a blocking product QA issue.

### Requirement: Visual component browser audit has fixed role and route inputs
Interactive course visual component browser audit SHALL declare representative routes, classroom roles, session preconditions, release steps, answer reveal steps, and diagnostics entry points.

#### Scenario: Browser audit lacks route or state inputs
- **WHEN** a browser audit report omits route, role, session id or fixture, release state, answer reveal state, diagnostics entry point, theme, viewport, or component id
- **THEN** course completion SHALL fail
- **AND** the audit SHALL NOT be accepted as evidence for the missing matrix cell.

### Requirement: Visual stage preserves shared chrome boundaries
Interactive course pages SHALL use `visual.stage` for complex two-dimensional visuals while preserving shared module chrome and role state.

#### Scenario: Stage appears with teacher controls
- **WHEN** a teacher releases, hides, reveals, or jumps a stage layer
- **THEN** the control SHALL attach to the stage or the target layer
- **AND** it SHALL NOT appear as a detached global drawer that obscures the primary stage.

#### Scenario: Stage uses light and dark themes
- **WHEN** a stage is rendered in light or dark mode
- **THEN** text, formulas, connectors, annotations, activity anchors, and disabled states SHALL remain readable
- **AND** the implementation acceptance artifact SHALL include student and teacher screenshots for both themes.

#### Scenario: Stage exposes only teaching semantics
- **WHEN** stage titles, layer labels, fallback text, or diagnostics are visible to students or teachers
- **THEN** they SHALL use teaching language
- **AND** they SHALL NOT expose module kinds, payload keys, file paths, renderer names, or platform implementation notes.

