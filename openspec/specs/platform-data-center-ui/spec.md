# platform-data-center-ui Specification

## Purpose
Define the platform UI contracts for a unified data center surface that separates presentation-ready aggregate metrics from admin governance details while sharing status, chart, shell, and evidence primitives.
## Requirements
### Requirement: Platform data center separates presentation and governance modes
The system SHALL provide platform data center UI contracts that distinguish presentation-ready aggregate metrics from admin governance details.

#### Scenario: User opens presentation data center
- **WHEN** an authorized user opens `/data-center` or a presentation-mode data center entry
- **THEN** the UI SHALL show aggregate platform metrics, module activity, learning trajectory summaries, simulation/Arena activity, classroom activity, and snapshot-ready charts where data is available
- **AND** it SHALL identify whether each metric is demo, real, partial, stale, or restricted.

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

