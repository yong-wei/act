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
Every RAG corpus chunk SHALL declare authority, retrieval scope, and source version or freshness metadata in addition to provenance, privacy, confidence, and freshness.

#### Scenario: Chunk is indexed
- **WHEN** a corpus chunk is created for teaching knowledge or learner evidence
- **THEN** it SHALL include authority level, knowledge tags where applicable, page or span anchor where available, freshness bucket, and scope rule
- **AND** validation SHALL reject chunks whose authority or scope metadata is missing or incompatible with their source type.

#### Scenario: Restricted learner evidence is indexed
- **WHEN** a chunk references private learner evidence, teacher-only summaries, grading anchors, or service-only traces
- **THEN** its scope rule SHALL prevent ordinary retrieval outside the authorized student, teacher, admin, or service scope
- **AND** redacted summaries SHALL be used when raw text is not visible.

#### Scenario: Versioned source chunk is indexed
- **WHEN** a corpus chunk is created from a graph-bound resource projection
- **THEN** it SHALL include source version or freshness limitation metadata where available
- **AND** citation verification SHALL preserve that metadata in CitationChip payloads when relevant.

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
Citation guardrails SHALL be visible in assistant-facing product surfaces.

#### Scenario: Citation verification fails
- **WHEN** a high-risk diagnosis, grading, path, or prep-pack answer lacks required verified citations
- **THEN** the response SHALL be blocked, degraded, or accompanied by an explicit fallback notice
- **AND** the route or response metadata SHALL expose the missing citation classes for debugging and acceptance tests.

#### Scenario: Generated output cites invalid evidence
- **WHEN** generated output cites missing, inaccessible, unsupported, low-authority, or privacy-violating chunks
- **THEN** the system SHALL reject, redact, or downgrade the output
- **AND** it SHALL expose the citation limitation to the caller.

#### Scenario: High-authority sources conflict
- **WHEN** retrieval finds conflicting high-authority sources or authorized learner evidence contradicts the generated claim
- **THEN** the response SHALL expose a conflict limitation or avoid making the disputed claim
- **AND** citation presence alone SHALL NOT qualify the answer as verified support for the disputed claim.

### Requirement: Citation rendering is shared
The system SHALL render verified learning-evidence citations through shared product-visible components or payload contracts.

#### Scenario: CitationChip payload is produced
- **WHEN** diagnosis, grading feedback, path advice, Konling answer, prep-pack, or teacher report code receives verified citations
- **THEN** each citation SHALL expose display title, source type, authority level, confidence, freshness, privacy visibility, href or null display target, and limitation state
- **AND** the same semantics SHALL be used across student, teacher, and administrator surfaces.
- **AND** student-visible payloads SHALL NOT expose privileged scope diagnostics or raw private evidence.

#### Scenario: Citation cannot be opened
- **WHEN** a citation points to restricted, redacted, missing, stale, or low-authority evidence
- **THEN** the UI SHALL expose the limitation state
- **AND** the system SHALL NOT present the citation as fully verified.

### Requirement: Citations resolve through server-owned addresses
Verified citations SHALL resolve through a server-owned CitationAddress contract rather than model-authored URLs.

#### Scenario: Citation target is resolved
- **WHEN** a generated answer references a verified chunk id, source span, or citation ref
- **THEN** the resolver SHALL produce the display href, address kind, display title, freshness state, and limitation state from server-owned metadata
- **AND** the model-generated answer SHALL NOT be trusted to construct the final URL.

#### Scenario: Deep link is unavailable
- **WHEN** a citation points to a missing block, stale hash, inaccessible media time range, restricted image, unregistered interactive step, or unsafe external URL
- **THEN** the system SHALL reject, redact, or downgrade the citation
- **AND** the product payload SHALL expose that the citation cannot be opened as a fully verified source.

### Requirement: Retrieval supports resource projections
The governed RAG corpus SHALL support resource retrieval projections for registered teaching resources without creating a separate unmanaged corpus.

#### Scenario: Scene-aware resource projection chunk is indexed
- **WHEN** a Markdown handout, knowledge card, runtime handout, video transcript, audio transcript, image description, exercise, simulation summary, Arena summary, or teacher-reviewed explanation is indexed
- **THEN** the chunk SHALL include resource id or source ref, segment ref, citation target ref where available, K/A/Q graph node refs where available, scene availability, authority level, privacy scope, freshness metadata, and content hash where available
- **AND** retrieval SHALL keep scope filtering, citation verification, and path eligibility as separate decisions.

### Requirement: Retrieval uses hybrid ranking
The RAG retrieval layer SHALL combine governed scope filtering with lexical, semantic, knowledge/capability, authority, freshness, and learner-context ranking signals.

#### Scenario: Exact technical term is queried
- **WHEN** a query includes a formula, exercise id, section title, named theorem, or control-system term
- **THEN** lexical or full-text matches SHALL remain eligible even when vector similarity is weak.

#### Scenario: Capability target is known
- **WHEN** the caller provides a knowledge node or capability target context
- **THEN** retrieval SHALL use those refs to filter or rerank candidates
- **AND** candidates outside permitted privacy scope SHALL remain inaccessible.
