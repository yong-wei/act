# textbook-hybrid-retrieval Specification

## Purpose
TBD - created by archiving change build-textbook-hybrid-retrieval. Update Purpose after archive.
## Requirements
### Requirement: Textbook retrieval uses a lightweight semantic benchmark
The system SHALL maintain a fixed project-level benchmark that maps realistic learning questions to all directly and completely supporting structural units and identifies the preferred citation source.

#### Scenario: A question has support in several textbooks
- **WHEN** the GPT labeling workflow finds multiple minimum units that independently support the question
- **THEN** every qualifying unit SHALL be recorded as an acceptable retrieval target
- **AND** the source-priority policy SHALL identify one preferred citation without treating other correct units as failures.

#### Scenario: Retrieval configuration is accepted
- **WHEN** the independent benchmark split is evaluated
- **THEN** at least 80 percent of questions SHALL retrieve one qualifying unit in the first 10 candidates
- **AND** every returned citation target and known regression case SHALL be valid.

### Requirement: Embedding selection is evidence-based
The exporter SHALL compare the declared embedding candidates on the same benchmark and SHALL pin one model and dimension for both offline windows and runtime queries.

#### Scenario: Candidate models are compared
- **WHEN** Qwen3 Embedding 0.6B, BGE-M3, and Qwen3 Embedding 4B are evaluated
- **THEN** the selected model SHALL meet the basic retrieval threshold
- **AND** the selection SHALL prefer the lower-cost passing configuration rather than model size alone.

#### Scenario: Index and query model differ
- **WHEN** a runtime query model identifier or dimension does not match the index manifest
- **THEN** vector retrieval SHALL be unavailable for that query
- **AND** the system SHALL use lexical retrieval instead of comparing incompatible vectors.

### Requirement: Textbook hybrid indexes are file-backed and bounded
The runtime SHALL expose a read-only lexical index, contiguous Float32 vector matrix, window metadata, and body offsets without loading the full textbook corpus into each request.

#### Scenario: Application process loads the index
- **WHEN** the shared textbook retrieval module initializes
- **THEN** one read-only index instance SHALL be shared within the application process
- **AND** its resident index budget SHALL not exceed 150 MiB for the six textbooks and one reference collection.

#### Scenario: Candidate body is needed
- **WHEN** a retrieval window reaches the bounded candidate set
- **THEN** its body SHALL be read through the recorded offset
- **AND** all textbook bodies SHALL NOT be retained in process memory.

### Requirement: Embedding indexes are built and cached locally
Offline vectors and final index files SHALL be generated and validated locally before deployment, while unchanged vectors MAY be reused from a content-addressed cache.

#### Scenario: A textbook is re-exported after a small edit
- **WHEN** most normalized retrieval windows retain the same model, dimension, normalization version, and content hash
- **THEN** their cached embeddings SHALL be reused
- **AND** only new or changed windows SHALL be sent to the embedding service.

#### Scenario: Final index is produced
- **WHEN** cached and new vectors are assembled
- **THEN** the exporter SHALL rebuild and validate the complete index manifest, vector count, dimensions, metadata rows, and body offsets
- **AND** the cache SHALL remain local, regenerable, and outside the deployed runtime.

### Requirement: Hybrid retrieval combines lexical, vector, and reranking signals
The retrieval service SHALL preserve exact and Chinese lexical matches, combine them with semantic similarity, and rerank a bounded candidate set through the configured external service.

#### Scenario: Query is retrieved normally
- **WHEN** query embedding succeeds
- **THEN** exact vector scanning and lexical retrieval SHALL produce approximately 20 to 30 candidate windows for external reranking
- **AND** the result SHALL retain each window's owning structural-unit identifiers and score bases.

#### Scenario: Query embedding fails
- **WHEN** the external embedding service is unavailable or returns an invalid vector
- **THEN** the request SHALL continue with lexical retrieval
- **AND** the failure SHALL be recorded without synthesizing a zero vector.

#### Scenario: Reranking fails
- **WHEN** the external reranker is unavailable, times out, or returns an invalid result
- **THEN** the request SHALL use the deterministic local fused ordering
- **AND** source authority alone SHALL NOT turn an irrelevant candidate into direct support.

### Requirement: External textbook retrieval excludes learner-private data
External embedding and reranking requests SHALL contain only the minimum normalized textbook query and bounded course-content candidates.

#### Scenario: Personalized context is available
- **WHEN** a caller also has learner state, path history, raw answers, private memory, or user identifiers
- **THEN** those values SHALL NOT be sent to the textbook embedding or reranking service
- **AND** authorized personalization SHALL remain in the local answer-generation context.
