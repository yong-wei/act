## ADDED Requirements

### Requirement: Retrieval supports resource projections
The governed RAG corpus SHALL support resource retrieval projections for registered teaching resources without creating a separate unmanaged corpus.

#### Scenario: Resource projection chunk is indexed
- **WHEN** a Markdown handout, knowledge card, runtime handout, video transcript, audio transcript, image description, exercise, simulation summary, Arena summary, or teacher-reviewed explanation is indexed
- **THEN** the chunk SHALL include resource id or source ref, segment ref, citation target ref where available, knowledge node refs, capability target refs where available, authority level, privacy scope, freshness metadata, and content hash where available.

#### Scenario: Personalized claim is requested
- **WHEN** retrieval is used for a personalized recommendation, path rationale, diagnosis, grading explanation, or Konling coaching claim
- **THEN** it SHALL include authorized learner evidence where available
- **AND** it SHALL expose missing or low-confidence learner evidence as a limitation rather than relying only on teaching knowledge.

### Requirement: Retrieval uses hybrid ranking
The RAG retrieval layer SHALL combine governed scope filtering with lexical, semantic, knowledge/capability, authority, freshness, and learner-context ranking signals.

#### Scenario: Exact technical term is queried
- **WHEN** a query includes a formula, exercise id, section title, named theorem, or control-system term
- **THEN** lexical or full-text matches SHALL remain eligible even when vector similarity is weak.

#### Scenario: Capability target is known
- **WHEN** the caller provides a knowledge node or capability target context
- **THEN** retrieval SHALL use those refs to filter or rerank candidates
- **AND** candidates outside permitted privacy scope SHALL remain inaccessible.
