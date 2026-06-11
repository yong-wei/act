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

### Requirement: Corpus chunks declare authority and scope
Every RAG corpus chunk SHALL declare authority and retrieval scope metadata in addition to provenance, privacy, confidence, and freshness.

#### Scenario: Chunk is indexed
- **WHEN** a corpus chunk is created for teaching knowledge or learner evidence
- **THEN** it SHALL include authority level, knowledge tags where applicable, page or span anchor where available, freshness bucket, and scope rule
- **AND** validation SHALL reject chunks whose authority or scope metadata is missing or incompatible with their source type.

#### Scenario: Restricted learner evidence is indexed
- **WHEN** a chunk references private learner evidence, teacher-only summaries, grading anchors, or service-only traces
- **THEN** its scope rule SHALL prevent ordinary retrieval outside the authorized student, teacher, admin, or service scope
- **AND** redacted summaries SHALL be used when raw text is not visible.

### Requirement: Retrieval separates teaching knowledge and learner evidence
The retrieval layer SHALL distinguish high-authority teaching knowledge from personalized learner evidence.

#### Scenario: Concept explanation is requested
- **WHEN** a user requests a course concept explanation
- **THEN** retrieval SHALL prioritize high-authority course content, terminology, runtime handouts, and knowledge cards
- **AND** learner evidence SHALL NOT be required unless the answer makes personalized claims.

#### Scenario: Personalized recommendation is requested
- **WHEN** a diagnosis, path, grading, Konling, or prep-pack response makes a personalized claim
- **THEN** retrieval SHALL include authorized learner evidence where available
- **AND** the response SHALL expose a limitation when learner evidence is missing or low confidence.

### Requirement: Generated answers are citation-guarded
The system SHALL verify citation adequacy before displaying or persisting generated assistant output.

#### Scenario: Citation verification fails
- **WHEN** generated output cites missing, inaccessible, unsupported, low-authority, or privacy-violating chunks
- **THEN** the system SHALL reject, redact, or downgrade the output
- **AND** it SHALL expose the citation limitation to the caller.

#### Scenario: High-authority sources conflict
- **WHEN** retrieval finds conflicting high-authority sources or learner evidence contradicts the generated claim
- **THEN** the answer SHALL include a conflict limitation or avoid making the disputed claim.

### Requirement: Citation rendering is shared
Student, teacher, grading, diagnosis, Konling, and prep-pack surfaces SHALL use a shared citation payload contract.

#### Scenario: CitationChip payload is produced
- **WHEN** a visible citation is returned to a UI surface
- **THEN** it SHALL include display title, href when allowed, source type, authority level, confidence, freshness, privacy visibility, and limitation state
- **AND** student-visible payloads SHALL NOT expose privileged scope diagnostics or raw private evidence.
