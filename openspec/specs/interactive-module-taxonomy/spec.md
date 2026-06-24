# interactive-module-taxonomy Specification

## Purpose
Defines the finite module taxonomy, orthogonal metadata fields, and migration-only legacy alias policy for manifest-driven interactive lessons.
## Requirements
### Requirement: Canonical module classes are finite
The system SHALL define a finite canonical module taxonomy for manifest-driven interactive lessons.

#### Scenario: Canonical classes are registered
- **WHEN** a manifest module is authored for a new or migrated lesson
- **THEN** its module class SHALL be one of `content.rich`, `content.cardSet`, `content.formula`, `content.table`, `content.figure`, `content.code`, `content.reveal`, `content.stageMap`, `activity.panel`, `activity.workspace`, `compute.panel`, `analytics.summary`, `layout.support`, or `legacy.adapter`
- **AND** `legacy.adapter` SHALL be marked migration-only.

### Requirement: Module kind does not encode orthogonal concerns
The module taxonomy SHALL keep presentation, course semantics, interaction behavior, response structure, compute capability binding, and programming language outside the canonical module class name.

#### Scenario: Presentation is a field
- **WHEN** a module needs row, grid, strip, column, tabs, or panel presentation
- **THEN** that choice SHALL be represented as a presentation field or renderer option
- **AND** it SHALL NOT create a new module class such as `summary-card-row`, `formula-strip`, or `step-reveal-column`.

#### Scenario: Course semantics are a field
- **WHEN** a module carries semantics such as goal, risk, term, bridge, teacher note, reference answer, misconception, or code purpose
- **THEN** that meaning SHALL be represented as a semantic role field
- **AND** it SHALL NOT create a course-specific module class.

#### Scenario: Answer structure is a response contract
- **WHEN** an activity collects single choice, multi-select, ordering, matching, text, structured, parameter, table answers, or code-edit responses
- **THEN** that structure SHALL be represented by the activity response contract
- **AND** it SHALL NOT create a module class such as `choice-check` or `scenario-sort-matrix`.

#### Scenario: Programming language is a field
- **WHEN** a lesson displays MATLAB, Python, C, or other source code as teaching content
- **THEN** the module class SHALL remain `content.code`
- **AND** the language SHALL be represented by a payload language field, not by a class such as `matlab-code`.

### Requirement: Legacy aliases are explicit and temporary
The system SHALL map historical `module.kind` values through an explicit alias table during migration.

#### Scenario: Legacy kind resolves through alias map
- **WHEN** a legacy manifest still contains a historical module kind
- **THEN** the runtime or migration tooling SHALL resolve it through a central alias map to a canonical module class
- **AND** the alias entry SHALL identify the replacement fields needed for equivalent rendering.

#### Scenario: New authoring rejects legacy aliases
- **WHEN** a new lesson or migrated manifest is validated
- **THEN** it SHALL use canonical module classes directly
- **AND** it SHALL NOT pass validation by relying on a legacy alias.

### Requirement: Canonical modules are registry-backed
The system SHALL provide a registry that defines each canonical interactive module class and the metadata needed to validate and render it.

#### Scenario: Registry entry describes module behavior
- **WHEN** a canonical module class is registered
- **THEN** the entry SHALL identify its class, renderer or activity-slot behavior, allowed configuration shape, evidence-producing status, and authoring availability
- **AND** the entry SHALL be usable by validation code without importing lesson-private components.

#### Scenario: Code module is content-only
- **WHEN** `content.code` is registered
- **THEN** the registry SHALL mark it as a content module that does not produce learner evidence
- **AND** it SHALL require auditable code payload fields such as language and source text.

### Requirement: Legacy aliases are registry-backed
The system SHALL keep every migration alias in one registry-backed map.

#### Scenario: Alias maps to canonical replacement
- **WHEN** an existing manifest contains a legacy kind such as `formula-strip`, `choice-check`, `step-reveal-list`, or `parametric-workspace`
- **THEN** the alias map SHALL identify the canonical module class and replacement fields
- **AND** validation output SHALL be able to name the alias and the canonical target.

### Requirement: Migrated manifests cannot use legacy aliases
The system SHALL reject legacy module aliases in migrated or newly authored manifests.

#### Scenario: Legacy alias in migrated manifest fails
- **WHEN** a migrated lesson manifest contains a historical module kind that is not a canonical module class
- **THEN** validation SHALL fail
- **AND** the failure SHALL identify the canonical replacement.

#### Scenario: New lesson invents a module kind
- **WHEN** a new lesson introduces a module kind not registered as a canonical module class
- **THEN** validation SHALL fail before the lesson can merge
- **AND** no lesson-private renderer registration SHALL make the unregistered kind acceptable.

### Requirement: Historical compatibility is isolated
The system SHALL keep any unavoidable historical compatibility paths separate from new or migrated manifest validation.

#### Scenario: Archive compatibility does not authorize new manifests
- **WHEN** a historical archive or compatibility reader can still interpret old module names
- **THEN** that compatibility SHALL NOT allow new or migrated runtime manifests to pass validation with old names.

### Requirement: Static 3D surface is a registered compute capability
The system SHALL register static 3D surface rendering as a compute capability usable by canonical `compute.panel` modules.

#### Scenario: Static surface compute panel is validated
- **WHEN** a runtime manifest module has `kind: compute.panel` and `payload.capabilityRef: static-surface-3d`
- **THEN** the module registry gate SHALL recognize the capability as registered
- **AND** the module SHALL still be subject to payload validation for required surface data or data asset references.

#### Scenario: Unregistered surface capability is used
- **WHEN** a lesson declares a 3D surface through an unregistered capability reference or a course-private module kind
- **THEN** the module registry gate SHALL fail before merge
- **AND** the failure SHALL identify the unsupported capability or module kind.

### Requirement: Static 3D surface payloads are auditable
The system SHALL require enough structured payload data for static 3D surface modules to be reviewed without lesson-private renderer knowledge.

#### Scenario: Static surface payload is authored
- **WHEN** a lesson authors a static 3D surface compute panel
- **THEN** its payload SHALL identify the data source, title, axis labels, color scale or value meaning, default camera, and fallback evidence
- **AND** those fields SHALL be inspectable by shared validation code.

### Requirement: Control analysis capabilities are shared compute capabilities
Interactive course manifests SHALL reference registered shared control workbench capabilities for control analysis panels.

#### Scenario: Course declares a shared control workbench capability
- **WHEN** a runtime manifest module has `kind: compute.panel`
- **AND** its capability is `control-workbench`, `control-linked-comparison`, `control-root-locus-design-map`, `control-frequency-reading-workbench`, `nonlinear-analysis-workbench`, or `training-workbench`
- **THEN** the module registry gate SHALL resolve it through a shared capability registry
- **AND** the runtime SHALL render through the shared control workbench or shared control analysis panels.

#### Scenario: Course uses a generic control analysis carrier
- **WHEN** a new or migrated course declares a control-analysis surface through `interactive-figure`, a lesson-private module kind, or a course-local registry entry
- **THEN** validation SHALL fail
- **AND** the error SHALL name the registered shared capability that should be used instead.

### Requirement: Course-private duplicate control panels are forbidden
Interactive course implementations SHALL NOT duplicate control workbench panels that already exist in the shared control system resources.

#### Scenario: Lesson-private control panel is introduced
- **WHEN** a change adds or modifies code under `src/features/interactive/unit-*`
- **AND** that code implements a time-domain, Bode, Nyquist, root-locus, performance, Rust/WASM request, compute fallback, or equivalent control analysis panel
- **THEN** the implementation gate SHALL fail unless a documented migration exception is present
- **AND** the exception SHALL identify the owning issue, expiry, and removal condition.

### Requirement: Visual stage is a canonical visual module
The interactive module taxonomy SHALL support `visual.stage` as a canonical visual module for non-stacked course visuals.

#### Scenario: Visual stage is authored
- **WHEN** a runtime manifest declares `kind: visual.stage`
- **THEN** the module registry SHALL validate `stageId`, aspect ratio, layers, normalized regions, z-index, and reveal state metadata
- **AND** the renderer SHALL be provided by shared manifest runtime rather than a lesson-private component.

#### Scenario: Stage layer is invalid
- **WHEN** a `visual.stage` layer has a missing id, duplicate id, invalid region, unsupported layer kind, or invalid reveal state reference
- **THEN** manifest validation SHALL fail before merge
- **AND** the error SHALL identify the stage id and layer id when available.

### Requirement: Visual stage is not a vertical card list
The visual stage renderer SHALL provide a two-dimensional stage layout rather than rendering layers as ordinary stacked modules.

#### Scenario: Stage renders in a course page
- **WHEN** a student or teacher opens a page containing `visual.stage`
- **THEN** layer positioning SHALL be computed from stage coordinates and z-index
- **AND** the resulting DOM and browser screenshot SHALL NOT show the stage as a `space-y` vertical list of cards.

### Requirement: Derivation stage is a registered visual module
The interactive module taxonomy SHALL support `visual.derivationStage` for two-dimensional formula derivation reveal.

#### Scenario: Derivation stage is authored
- **WHEN** a runtime manifest declares `kind: visual.derivationStage`
- **THEN** the registry SHALL validate formulas, formula blocks, text blocks, connectors, reveal steps, regions, layer ordering, transition metadata, and teacher control metadata
- **AND** the renderer SHALL be shared by manifest runtime rather than a lesson-private page branch.

#### Scenario: Formula lacks LaTeX source
- **WHEN** a derivation stage formula or formula block is represented only by an image, plain text, or an unparseable display string
- **THEN** validation SHALL fail
- **AND** the error SHALL identify the formula id or formula block id.

### Requirement: Derivation reveal order is non-linear
Derivation stage reveal SHALL be driven by explicit target ids and regions rather than DOM order.

#### Scenario: Reveal returns to an earlier visual region
- **WHEN** reveal step 3 targets a lower-left formula, reveal step 4 targets an upper-right note, and reveal step 5 targets a middle formula block
- **THEN** the renderer SHALL reveal those targets in the declared order
- **AND** acceptance SHALL fail if the implementation can only reveal vertical cards from top to bottom.

### Requirement: Derivation formula blocks support semantic color roles
Derivation stage formula blocks SHALL support semantic color roles for local teaching emphasis.

#### Scenario: Formula block is marked as a cancel term
- **WHEN** a formula block has `colorRole: cancel`
- **THEN** only that formula block SHALL receive the cancel visual treatment
- **AND** adjacent formula blocks SHALL remain independently addressable and readable in light and dark themes.

### Requirement: Derivation stage controls cognitive load
Derivation stage authoring SHALL define cognitive load limits for reveal density, long-formula splitting, semantic color usage, and default release pace.

#### Scenario: Reveal step is overloaded
- **WHEN** a derivation reveal step introduces too many formula blocks, too many simultaneous color roles, or an undeclared long-formula split strategy
- **THEN** validation SHALL fail or require an explicit teaching-load exception
- **AND** the acceptance artifact SHALL explain the intended learner reasoning step.

### Requirement: Block diagram is a registered visual module
The interactive module taxonomy SHALL support `visual.blockDiagram` for control-system structure diagrams.

#### Scenario: Block diagram is authored
- **WHEN** a runtime manifest declares `kind: visual.blockDiagram`
- **THEN** the registry SHALL validate nodes, edges, labels, positions, interaction mode, and reveal metadata
- **AND** the renderer SHALL use the shared visual runtime rather than a lesson-private SVG or screenshot.

#### Scenario: Block diagram requires interaction
- **WHEN** a block diagram asks students to select, construct, diagnose, or compare a structure
- **THEN** a static image SHALL NOT satisfy the manifest contract
- **AND** validation SHALL require structured nodes and edges that can produce evidence.

### Requirement: Signal flow graph is a registered visual module
The interactive module taxonomy SHALL support `visual.signalFlowGraph` for signal-flow graph reading and Mason formula mapping.

#### Scenario: Signal flow graph is authored
- **WHEN** a runtime manifest declares `kind: visual.signalFlowGraph`
- **THEN** the registry SHALL validate nodes, directed branches, gain labels, path sets, loops, non-touching loop groups, and reveal plan metadata
- **AND** the renderer SHALL support shared path and loop highlighting.

#### Scenario: Mason formula is shown
- **WHEN** a signal-flow graph page displays Mason formula terms
- **THEN** each visible path or loop term SHALL be traceable to graph path ids or loop ids
- **AND** acceptance SHALL fail if a table of terms replaces required graph highlighting.

### Requirement: Annotated media is a registered visual module
The interactive module taxonomy SHALL support `visual.annotatedMedia` for evidence-bearing media surfaces.

#### Scenario: Annotated media is authored
- **WHEN** a runtime manifest declares `kind: visual.annotatedMedia`
- **THEN** the registry SHALL validate media source, alt text, annotation ids, normalized regions, evidence roles, reveal step references, and selectable annotation metadata
- **AND** the renderer SHALL be shared by manifest runtime rather than a lesson-private image wrapper.

#### Scenario: Media text leaks implementation details
- **WHEN** a media title, caption, annotation label, fallback, or visible diagnostic contains a file path, module kind, renderer name, payload key, or internal id
- **THEN** validation SHALL fail
- **AND** the failure SHALL identify the visible text source.

### Requirement: Embedded activity is a registered visual activity layer
Interactive course visuals SHALL support `visual.embedded-activity` anchors that collect answers inside the visual surface.

#### Scenario: Activity is embedded in a visual surface
- **WHEN** a visual stage or annotated media module includes `visual.embedded-activity`
- **THEN** the activity SHALL declare a canonical response contract
- **AND** it SHALL use shared activity submission evidence rather than a course-private data path.

