## MODIFIED Requirements

### Requirement: Citation rendering is shared
The system SHALL render verified learning-evidence citations through shared product-visible components or payload contracts.

#### Scenario: CitationChip payload is produced
- **WHEN** diagnosis, grading feedback, path advice, Konling answer, prep-pack, or teacher report code receives verified citations
- **THEN** each citation SHALL expose display title, source type, authority level, confidence, freshness, privacy visibility, href or null display target, and limitation state
- **AND** the same semantics SHALL be used across student, teacher, and administrator surfaces.

#### Scenario: Citation cannot be opened
- **WHEN** a citation points to restricted, redacted, missing, stale, or low-authority evidence
- **THEN** the UI SHALL expose the limitation state
- **AND** the system SHALL NOT present the citation as fully verified.

### Requirement: Generated answers are citation-guarded
Citation guardrails SHALL be visible in assistant-facing product surfaces.

#### Scenario: Citation verification fails
- **WHEN** a high-risk diagnosis, grading, path, or prep-pack answer lacks required verified citations
- **THEN** the response SHALL be blocked, degraded, or accompanied by an explicit fallback notice
- **AND** the route or response metadata SHALL expose the missing citation classes for debugging and acceptance tests.
