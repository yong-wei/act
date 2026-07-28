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
- **THEN** retrieval SHALL prioritize high-authority course content, terminology, runtime handouts, textbooks, reference sections, figures, knowledge cards, and graph-bound resource chunks
- **AND** learner evidence SHALL NOT be required unless the answer makes personalized claims.
- **AND** missing learner evidence SHALL NOT prevent the response from returning verified teaching-content citations when those citations are available.

#### Scenario: Personalized recommendation is requested
- **WHEN** a diagnosis, path, grading, Konling, or prep-pack response makes a personalized claim
- **THEN** retrieval SHALL include authorized learner evidence where available
- **AND** the response SHALL expose a limitation when learner evidence is missing or low confidence.
- **AND** the limitation SHALL affect personalization scope, confidence, and recommendation style rather than causing teaching-content retrieval to fail.

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

### Requirement: Grounded textbook and media citations resolve through server-owned addresses
Verified citations SHALL resolve through a server-owned CitationAddress contract rather than model-authored URLs.

#### Scenario: Citation comes from external-tool output
- **WHEN** transcript tooling, OCR, local vision models, or prompt extraction supply a candidate citation or description
- **THEN** the system SHALL resolve display href and limitation state from server-owned metadata
- **AND** it SHALL NOT trust generated text to construct final citation URLs or verified source claims.

#### Scenario: Student evidence is protected from external processing
- **WHEN** RAG grounding or citation tooling records external/local tool metadata
- **THEN** the record SHALL include tool name, version, input scope, output hash, permission, and retention rule
- **AND** student raw answers, classroom evidence, and learner state SHALL NOT be sent to external tools by default.

### Requirement: Reviewed resource projections have complete citation anchors
Reviewed resource projections used by path planning or Konling grounding SHALL have mapped retrieval chunks and server-owned citation anchors, or explicit limitation states.

#### Scenario: Reviewed projection is indexed
- **WHEN** a reviewed textbook section, reference section, media transcript, slide segment, image description, figure, handout, or runtime support resource is indexed
- **THEN** the retrieval chunk SHALL reference its ResourceSegment, CitationTarget, CitationAddress metadata, authority, privacy scope, source hash, freshness, and review state
- **AND** citation verification SHALL resolve display links from server-owned metadata.

#### Scenario: Anchor is incomplete
- **WHEN** a transcript, page, figure, equation, timestamp, slide, image, or external href anchor is missing or stale
- **THEN** the citation SHALL be downgraded or limited
- **AND** the helper SHALL report the missing anchor separately from path-planning disposition.

### Requirement: Reviewed knowledge visuals expose citation-safe grounding
Reviewed knowledge cards and infographs SHALL provide citation-safe grounding metadata when used by Konling or path rationale.

#### Scenario: Knowledge visual grounds an answer
- **WHEN** a reviewed knowledge card or infograph is retrieved for a Konling explanation or path rationale
- **THEN** the retrieval record SHALL include graph-node refs, LearningGoal refs where applicable, source hash, authority, review state, citation target, privacy scope, and limitation state
- **AND** citation display links SHALL resolve through server-owned citation metadata.

#### Scenario: Knowledge visual anchor is incomplete
- **WHEN** an image, description, card route, or infograph anchor is missing or stale
- **THEN** the citation SHALL be downgraded or limited
- **AND** the helper SHALL report the missing anchor separately from path-planning disposition.

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
