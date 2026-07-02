## ADDED Requirements

### Requirement: SAR expands associations from governed seed refs
The system SHALL provide a deterministic association expansion provider over projected SAR events and entities.

#### Scenario: Zero-hop expansion is requested
- **WHEN** a caller supplies seed refs and requests zero-hop expansion
- **THEN** SAR SHALL return directly associated events, entities, selected refs, rejected refs, and limitations within the caller scope.

#### Scenario: Multi-hop expansion is requested
- **WHEN** a caller requests one-hop or two-hop expansion
- **THEN** SAR SHALL expand from seed entities to events and connected entities, then to additional events within the requested hop budget
- **AND** it SHALL record the hop path in trace metadata.

### Requirement: SAR expansion enforces caller scope before returning candidates
The system SHALL filter association results by role, student, class, privacy scope, authority, and use case before exposing candidates.

#### Scenario: Student-visible expansion finds scoped evidence
- **WHEN** a student-scoped SAR query reaches teacher-scoped, admin-scoped, audit-only, or another student's private events
- **THEN** those events SHALL be excluded or redacted
- **AND** the trace SHALL include rejected refs or limitations without leaking raw private details.

### Requirement: SAR expansion feeds Source Pack instead of replacing it
SAR SHALL return candidate refs and trace suitable for downstream Source Pack retrieval.

#### Scenario: Downstream evidence pack is needed
- **WHEN** a consumer needs ranked excerpts, citation hydration, or verified citation chips
- **THEN** SAR SHALL provide candidate `eventId`, `entityId`, `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, or `planningUnitId` refs
- **AND** Source Pack or the governed citation layer SHALL own ranking, excerpt budgets, citation verification, and CitationChip payloads.
