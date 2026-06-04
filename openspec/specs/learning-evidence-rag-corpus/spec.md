# learning-evidence-rag-corpus Specification

## Purpose
Define the governed evidence corpus and citation verification contract used by diagnosis, Konling, recommendations, grading, teacher reports, and prep-pack generation.
## Requirements
### Requirement: RAG corpus preserves governed source provenance
The system SHALL index learning evidence and course content as governed corpus chunks with source provenance.

#### Scenario: Corpus chunk is created
- **WHEN** a course content, knowledge card, runtime handout, path summary, diagnosis, grading artifact, simulation summary, Arena summary, or teacher report excerpt is indexed
- **THEN** the chunk SHALL include source type, source ref, span or location ref, display title, display href, content hash, privacy class, confidence, and freshness metadata.

#### Scenario: Corpus source is restricted
- **WHEN** a source includes raw answer bodies, private Konling memory, hidden Arena internals, raw traces, or audit-only data
- **THEN** only a redacted summary or stable reference SHALL be available to ordinary student or teacher retrieval.

### Requirement: Citations are verified after generation
The system SHALL verify citations independently from model generation before displaying or persisting them.

#### Scenario: Citation is valid
- **WHEN** a generated answer references a candidate chunk id visible to the current role and scope
- **THEN** the verifier SHALL confirm chunk existence, source accessibility, source-type compatibility, quote hash or span ref where applicable, and privacy visibility.

#### Scenario: Citation is fake or inaccessible
- **WHEN** a generated answer references a missing, inaccessible, unsupported, or privacy-violating chunk id
- **THEN** the system SHALL reject, redact, or downgrade the answer before display
- **AND** it SHALL expose the citation limitation to the caller.
