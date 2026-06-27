## Purpose

Define governed Source Pack retrieval evidence packages for authoring tools, Konling, and path planning.
## Requirements
### Requirement: Source Pack contract defines governed retrieval evidence packages
The system SHALL expose a Source Pack contract that represents a governed, auditable evidence package for authoring tools, Konling, and path planning.

#### Scenario: Source Pack is generated
- **WHEN** a caller asks for a Source Pack
- **THEN** the pack SHALL include a stable pack id, caller profile, query context, index or projection version refs, coverage summary, selected items, limitations, and audit metadata
- **AND** every item SHALL retain stable source identifiers such as `retrievalChunkId`, `citationTargetId`, `resourceNodeId`, or `planningUnitId` when those identifiers are available.

#### Scenario: Source Pack item is serialized
- **WHEN** a Source Pack item is rendered to JSON or Markdown
- **THEN** it SHALL preserve title, source kind, modality, excerpt, inclusion rationale, score fields, access metadata, and citation metadata
- **AND** it SHALL NOT rely on model-authored URLs or raw authoring-file line numbers as the verified citation target.

### Requirement: Source Pack CLI is a thin wrapper over shared core
The system SHALL provide a CLI shell for local authoring and agent workflows without making the CLI the retrieval source of record.

#### Scenario: CLI builds a pack
- **WHEN** an authoring workflow runs the Source Pack CLI with a query and profile
- **THEN** the CLI SHALL call the shared Source Pack builder
- **AND** it SHALL be able to write JSON, Markdown, and audit outputs with the same contract used by server consumers.

#### Scenario: CLI cannot satisfy retrieval
- **WHEN** a requested adapter, index, or retrieval mode is unavailable
- **THEN** the CLI SHALL return a valid Source Pack with explicit limitations or a structured failure
- **AND** it SHALL NOT silently fall back to unmanaged raw Markdown scanning.
