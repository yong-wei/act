# platform-data-center-ui Specification

## Purpose
Define the platform UI contracts for a unified data center surface that separates presentation-ready aggregate metrics from admin governance details while sharing status, chart, shell, and evidence primitives.
## Requirements
### Requirement: Platform data center separates presentation and governance modes
The system SHALL provide platform data center UI contracts that distinguish presentation-ready aggregate metrics from admin governance details.

#### Scenario: User opens presentation data center
- **WHEN** an authorized teacher or administrator opens `/data-center` or a presentation-mode data center entry
- **THEN** the UI SHALL show aggregate platform metrics, module activity, learning trajectory summaries, simulation/Arena activity, classroom activity, and snapshot-ready charts where data is available
- **AND** it SHALL identify whether each metric is real, partial, stale, or restricted.
- **AND** visible demo-source labels SHALL be controlled by administrator display policy rather than always shown in ordinary presentation UI.

### Requirement: Admin governance mode exposes data health
The system SHALL keep admin data-center governance details available without mixing them into presentation-only views.

#### Scenario: Admin opens governance data center
- **WHEN** an admin opens `/admin/states` or an admin governance data-center mode
- **THEN** the UI SHALL show source coverage, readiness, missing context, stale data, privacy scope, unsupported states, and governed drilldown links where available.

### Requirement: Data center snapshots are privacy-safe
The system SHALL keep exported or screenshot-oriented data-center summaries privacy-safe and source-marked.

#### Scenario: Presentation snapshot is generated
- **WHEN** a data-center summary is exported, captured, or prepared for presentation
- **THEN** it SHALL remove raw learner evidence, raw high-frequency traces, hidden official evaluation internals, raw answers, and private memory
- **AND** it SHALL retain source quality markers for demo, real, partial, stale, or restricted metrics.
- **AND** demo source quality SHALL remain available in snapshot, export, or governance contexts even when ordinary UI hides the visible demo label.

### Requirement: Demo source labels follow administrator display policy
Data center UI SHALL hide or show visible demo-source labels according to administrator policy without changing source truth.

#### Scenario: Demo label display is disabled
- **WHEN** ordinary data-center presentation UI renders with demo-label display disabled or unset
- **THEN** visible source markers SHALL NOT display a "demo data" tag for demo metrics.
- **AND** internal source quality, provenance, source family, audit, and export semantics SHALL still classify the metric as demo.

#### Scenario: Demo label display is enabled
- **WHEN** ordinary data-center presentation UI renders with demo-label display enabled
- **THEN** visible source markers SHALL display the demo-source marker using shared source-quality semantics.
- **AND** the setting SHALL NOT change metric values, evidence scoring, source coverage, or governance classification.

### Requirement: Data center uses shared chart and status primitives
The system SHALL use platform chart, shell, navigation, and status primitives for data-center surfaces.

#### Scenario: Data-center panel renders
- **WHEN** a data-center chart, metric card, status row, or drilldown link renders
- **THEN** it SHALL use shared platform tokens, chart panel contracts, role navigation, and evidence/status semantics rather than page-local palettes or ad hoc labels.

### Requirement: Data center surfaces share knowledge-data map semantics
The data center UI SHALL use knowledge/data map visual semantics for source quality, freshness, privacy scope, and status legend.

#### Scenario: Data center snapshot renders
- **WHEN** `/data-center` or a governance data snapshot renders
- **THEN** it SHALL show source quality, freshness, privacy scope, and evidence/status legend using governed platform roles
- **AND** it SHALL NOT present data blocks as disconnected generic metric cards.

### Requirement: Data center actions remain connected to governance and review
The data center UI SHALL preserve action context for source quality and governance state.

#### Scenario: Data center shows stale, partial, restricted, or low-quality data
- **WHEN** a source, metric, snapshot, or governance block is stale, partial, restricted, or low quality
- **THEN** the UI SHALL show the reason, privacy scope, next review or repair action, and report/export availability where applicable
- **AND** the state SHALL NOT be replaced by generic status color alone.

### Requirement: Data snapshots support report-ledger export semantics
Data center and governance snapshots SHALL support report-ledger presentation for review and export contexts.

#### Scenario: Snapshot is shared or exported
- **WHEN** a data center or governance snapshot is captured for review
- **THEN** it SHALL show source quality, freshness, privacy scope, evidence/status legend, and timestamp or run context
- **AND** interactive controls SHALL not replace the required report context.

### Requirement: Report-ledger presentation does not own source page shells
Report-ledger presentation SHALL remain separate from the operational or knowledge shell that produces the report data unless route ownership is explicitly transferred.

#### Scenario: Snapshot originates from another route family
- **WHEN** a snapshot originates from data center, admin governance, teacher analytics, learner record, or Arena surfaces
- **THEN** report-ledger presentation SHALL preserve report/export semantics without replacing the source route's owning shell
- **AND** any shell ownership transfer SHALL be declared in the route ledger.

### Requirement: Knowledge and data surfaces share evidence map semantics
Knowledge graph, evidence browser, learner record, and data center surfaces SHALL share source quality, freshness, privacy, confidence, and status semantics when migrated to the knowledge-data-map archetype.

#### Scenario: Evidence-backed data is shown
- **WHEN** a migrated knowledge or data surface displays evidence, graph, source, freshness, privacy, confidence, or unsupported state information
- **THEN** the UI SHALL use shared evidence map semantics and platform shell navigation
- **AND** it SHALL not introduce page-local status vocabularies or unmanaged visual palettes.
