## ADDED Requirements

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
