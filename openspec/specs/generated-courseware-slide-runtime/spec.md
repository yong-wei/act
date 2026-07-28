# generated-courseware-slide-runtime Specification

## Purpose
TBD - created by archiving change standardize-generated-courseware-slide-runtime. Update Purpose after archive.
## Requirements
### Requirement: Generated slides use a BOPPPS stage, step, and module hierarchy
The shared generated-courseware runtime SHALL use the hierarchy `BOPPPS stage -> courseware step -> module`, with a step as both the online slide and export-page boundary.

#### Scenario: A complete slide manifest is validated
- **WHEN** a generated-courseware manifest reaches complete status
- **THEN** all six BOPPPS stages SHALL appear in order
- **AND** the manifest SHALL contain 6 through 24 ordered steps with 1 through 3 modules in every step.

#### Scenario: A stage contains multiple steps
- **WHEN** a BOPPPS stage requires several teaching moments
- **THEN** the stage SHALL allow multiple ordered steps
- **AND** each step SHALL retain its own title, duration, layout, modules, and stage identity.

#### Scenario: Courseware timing is checked
- **WHEN** a manifest is validated
- **THEN** step durations SHALL sum to their BOPPPS stage duration and all stages SHALL sum exactly to the lesson duration
- **AND** inconsistent timing SHALL produce a deterministic validation issue.

### Requirement: Generated modules use a strict cross-disciplinary allowlist
The runtime schema SHALL expose only registered generic module classes and canonical response kinds approved for P0.

#### Scenario: Content module is validated
- **WHEN** a manifest contains a generated content module
- **THEN** its canonical class SHALL be one of `content.rich`, `content.cardSet`, `content.formula`, `content.table`, `content.code`, or `content.reveal`
- **AND** its payload SHALL pass the existing registry schema for that class.

#### Scenario: Activity module is validated
- **WHEN** a manifest contains a generated activity
- **THEN** it SHALL use a registered activity carrier with one of `choice.single`, `choice.multi`, `text.short`, `text.long`, `ordering.sequence`, or `matching.pairs`
- **AND** submission SHALL use the existing canonical response and evidence path.

#### Scenario: Unsupported module is proposed
- **WHEN** output contains a new module kind, simulation, compute panel, image/video/3D module, course-private component, or arbitrary code renderer
- **THEN** validation SHALL reject that module
- **AND** it SHALL identify the unsupported class or capability without registering it dynamically.

### Requirement: Every generated step uses a fixed 16:9 registered layout
Every generated-courseware step SHALL occupy one fixed 16:9 canvas using a registered finite layout template, fixed grid, and named non-overlapping slots.

#### Scenario: A manifest assigns a layout
- **WHEN** a generated step is validated
- **THEN** it SHALL reference a registered layout template id and assign each module to one compatible named slot
- **AND** the manifest SHALL NOT contain CSS, absolute coordinates, arbitrary dimensions, or overlapping regions.

#### Scenario: Slot occupancy is validated
- **WHEN** static layout validation runs
- **THEN** each occupied grid cell SHALL belong to exactly one module slot, every slot SHALL remain within the canvas, and every module SHALL fit its declared slot
- **AND** an area sum alone SHALL NOT satisfy occupancy validation.

#### Scenario: A layout assignment changes
- **WHEN** a consumer changes a registered template or slot assignment
- **THEN** validation SHALL accept it only when every module size is compatible and occupancy remains valid
- **AND** incompatible assignments SHALL fail rather than silently clip content.

### Requirement: Generated modules use registered size variants and text budgets
Every generatable module SHALL declare a registered size variant with fixed slot dimensions, suggested text length, and a bounded readable font-fit range.

#### Scenario: Generated text is within the suggested budget
- **WHEN** module content fits the registered budget for its type and size
- **THEN** the renderer SHALL use the normal registered typography without page growth.

#### Scenario: Text exceeds the suggestion but remains readable
- **WHEN** content exceeds the suggested length but fits through bounded font adaptation above the minimum readable size
- **THEN** the renderer MAY expose a length warning
- **AND** validation MAY pass when fixed-viewport measurement finds no overflow or clipping.

#### Scenario: Text cannot fit readably
- **WHEN** a module still overflows at the minimum readable font size
- **THEN** fixed-viewport validation SHALL fail that step
- **AND** the renderer SHALL NOT use truncation, internal scrolling, hidden overflow, or page growth to conceal the failure.

### Requirement: Static slide validation is deterministic
The shared runtime SHALL provide a pure static validator with stable issue codes and machine-readable locations.

#### Scenario: Static validation runs
- **WHEN** a generated-courseware manifest is submitted for validation
- **THEN** the validator SHALL check hierarchy, BOPPPS order, timing, step/module bounds, allowlist, schemas, slot occupancy, size compatibility, text budgets, and role-safe activity metadata
- **AND** every issue SHALL identify the affected stage, step, or module without relying on LLM judgment.

#### Scenario: Validated content changes
- **WHEN** content, layout, timing, module metadata, or role metadata changes
- **THEN** the manifest content hash SHALL change
- **AND** prior validation results SHALL NOT be treated as results for the new hash.

### Requirement: Fixed-viewport slide validation detects visual overflow
The shared runtime SHALL expose a fixed-browser validation procedure for generated slides using pinned fonts and a fixed 16:9 viewport.

#### Scenario: Browser validation runs
- **WHEN** a statically valid manifest is rendered for visual validation
- **THEN** a pinned Playwright browser SHALL measure canvas and slot bounds, overlap, clipping, scroll overflow, formula width, and minimum font size for teacher and student projections
- **AND** any overflow, overlap, clipping, or unreadable font SHALL produce a deterministic failure.

### Requirement: Existing preset interactive lessons remain compatible
The shared renderer changes SHALL preserve existing preset interactive lessons that do not opt into the generated-slide contract.

#### Scenario: A legacy preset lesson renders
- **WHEN** an existing registered preset lesson is opened after the shared runtime change
- **THEN** its current manifest and registry path SHALL continue to render without generated-courseware metadata
- **AND** no migration to the generated allowlist, fixed layout catalog, or text-budget schema SHALL be required.

#### Scenario: A generated slide renders responsively
- **WHEN** a valid generated step is viewed on a screen that is not 16:9
- **THEN** the complete fixed 16:9 canvas SHALL scale as one unit while preserving its internal geometry
- **AND** responsive scaling SHALL NOT change slot occupancy or export geometry.
