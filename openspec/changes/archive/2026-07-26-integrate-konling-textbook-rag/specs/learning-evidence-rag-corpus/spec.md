## MODIFIED Requirements

### Requirement: Citations are verified after generation
The system SHALL verify citations independently from model generation before final display or persistence while preserving user-readable prose when citation mapping fails.

#### Scenario: Citation is valid
- **WHEN** a generated answer references a server-assigned citation visible to the current role and scope
- **THEN** the verifier SHALL confirm source existence, accessibility, source-type compatibility, structural-unit or evidence identity, and privacy visibility.

#### Scenario: Citation is fake or inaccessible
- **WHEN** a generated answer contains missing, inaccessible, unsupported, ambiguous, or privacy-violating citation markers
- **THEN** invalid markers and links SHALL be removed from production prose while valid citations remain
- **AND** the final citation area SHALL show `部分引用未能核验`.

#### Scenario: All textbook citations are unresolved
- **WHEN** no textbook citation in an otherwise completed answer can be verified after the single repair attempt
- **THEN** the answer prose SHALL remain visible without invalid markers or links
- **AND** the citation area SHALL show `引用未能核验`.

### Requirement: Textbook and reviewed media projections enter the governed RAG corpus
The governed RAG corpus SHALL support structured textbook units, retrieval windows, and reviewed media projections without creating a separate unmanaged corpus.

#### Scenario: Grounded textbook chunk is indexed
- **WHEN** a reviewed textbook structural unit, fragment, or retrieval window is indexed
- **THEN** it SHALL include owning unit id, stable structure path, fragment or page anchor where applicable, source version, authority, graph refs, citation target, privacy scope, and content hash
- **AND** retrieval windows SHALL NOT become verified citation identities.

#### Scenario: Reviewed media projection chunk is indexed
- **WHEN** a transcript segment, image description, slide segment, or infograph description from a validated media ingestion projection is indexed
- **THEN** the chunk SHALL include segment anchor, source version, AI-use permission, review state, graph refs, citation target, privacy scope, freshness metadata, tool/version where applicable, input scope, output hash, retention rule, and limitation state
- **AND** provisional chunks SHALL be retrievable only with a limitation state until reviewed.

## ADDED Requirements

### Requirement: Content and evidence citations share one visible sequence
The final citation presentation SHALL assign one deterministic display sequence across textbook content and authorized learning evidence.

#### Scenario: Answer uses textbook and learner evidence
- **WHEN** a response contains both content support and a personalized claim
- **THEN** the server SHALL assign one `[1]`, `[2]` sequence after type-aware deduplication
- **AND** each item SHALL retain its source type, visibility, limitation, and authorized target.

### Requirement: Textbook runtime v2 replaces legacy citation identities
After the final series cutover, the governed corpus SHALL use v2 structural units and fragments for textbook citation identity.

#### Scenario: Production corpus is switched
- **WHEN** the v2 runtime, hybrid index, reader, and consumers pass full local validation
- **THEN** old textbook section, chunk, search-document, and citation-map consumers SHALL be removed
- **AND** the system SHALL NOT retain a legacy mapping, redirect, or parallel production corpus.

## REMOVED Requirements

### Requirement: Long-form planning units retain chunk-level citation support
**Reason**: Textbook chunk identity is replaced by stable structural-unit and fragment identity; overlapping windows remain retrieval-only.
**Migration**: PlanningUnit support SHALL reference related structural units, fragments, and their server-owned citation addresses.

### Requirement: Textbook search-document rows are classified in citation shards
**Reason**: Legacy search-document rows are removed by the v2 runtime and cannot remain the verified textbook citation boundary.
**Migration**: Review and citation readiness SHALL be expressed on v2 structural units, fragments, retrieval windows, source metadata, and explicit limitation states.
