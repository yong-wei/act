## ADDED Requirements

### Requirement: Canonical diagnostic student fixtures are gated by data completeness
The system SHALL provide deterministic diagnostic student fixture generation only after required graph and resource data completeness gates pass.

#### Scenario: Fixture precondition fails
- **WHEN** a diagnostic fixture command is requested for a canonical test student
- **AND** the data completeness helper reports blocking graph, resource, citation, or path-planning gaps for the targeted test scope
- **THEN** the fixture command SHALL refuse to apply mock learner-state data
- **AND** it SHALL report the blocking completeness dimensions.

#### Scenario: Fixture precondition passes
- **WHEN** the targeted graph and resource completeness gates pass
- **THEN** the fixture command MAY materialize governed learner-state records for the canonical test student
- **AND** every created record SHALL include deterministic fixture provenance and source references.

### Requirement: Yang Fan diagnostic fixture is canonical and idempotent
The system SHALL provide an explicit Yang Fan diagnostic fixture command for local/development testing.

#### Scenario: Canonical Yang Fan is resolved
- **WHEN** the Yang Fan fixture command runs
- **THEN** it SHALL resolve the canonical account by stable email or student number
- **AND** it SHALL report duplicate account candidates before any apply-mode mutation.

#### Scenario: Duplicate account is removed safely
- **WHEN** a duplicate no-email Yang Fan account contains only safe fixture-owned or migratable records
- **THEN** the command MAY migrate safe records to the canonical account and delete the duplicate
- **AND** repeated runs SHALL NOT recreate duplicate accounts or duplicate learner evidence.

#### Scenario: Duplicate account contains unsafe records
- **WHEN** a duplicate account contains records that cannot be safely classified as fixture-owned or migratable
- **THEN** the command SHALL stop before deletion
- **AND** it SHALL report the blocking record families for manual review.

#### Scenario: Yang Fan learner evidence is materialized
- **WHEN** the fixture applies after preconditions pass
- **THEN** it SHALL create or update traceable LearningFacts, KnowledgeProgress, LearningPathExecution evidence references, adaptive assessment state, StudentCompetencySnapshot, StudentProfileSummary, and StudentEvidenceFeatureCache records for the canonical account
- **AND** the result SHALL support graph-grounded Konling, path planning/continuation, and adaptive answering tests without relying on hidden raw records.

#### Scenario: Fixture write is production-protected
- **WHEN** the Yang Fan fixture command is executed in production mode, against a production-denied database URL, against a database not allowlisted for fixture writes, or without an explicit apply confirmation
- **THEN** it SHALL refuse to mutate data
- **AND** it SHALL provide a dry-run summary or safety diagnostic instead.

#### Scenario: Fixture output is privacy minimized
- **WHEN** the Yang Fan fixture command prints dry-run, apply, reset, or audit output
- **THEN** it SHALL redact or hash direct student identifiers by default
- **AND** it SHALL NOT print raw answers, raw event payloads, raw resource content, private memory content, or hidden evaluation internals.

#### Scenario: Arena official result boundary is preserved
- **WHEN** Yang Fan fixture evidence includes Arena-related learning context
- **THEN** fixture-created LearningFacts, feature-cache entries, or path evidence SHALL be treated only as auxiliary learning evidence
- **AND** official score, validity, ranking, leaderboard state, and official submission result semantics SHALL remain sourced only from `ArenaSubmission` and governed official Arena evaluation records.
