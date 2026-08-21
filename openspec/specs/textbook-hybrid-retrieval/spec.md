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
- **AND** its resident index budget SHALL not exceed 150 MiB for the current declared resource set.

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

### Requirement: Runtime index path is contractually fixed
The system SHALL use `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3` as the default runtime path for the BGE-M3 hybrid retrieval index. Index root resolution SHALL use explicit `indexRoot`, then `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT`, then the default path.

#### Scenario: No explicit path or environment variable
- **WHEN** the textbook Source Pack adapter is called without `indexRoot` and `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT` is unset
- **THEN** the adapter SHALL resolve the index root to `course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3`

#### Scenario: Environment variable overrides default
- **WHEN** `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT` is set and no explicit `indexRoot` is provided
- **THEN** the adapter SHALL use the environment variable value

#### Scenario: Explicit indexRoot overrides environment
- **WHEN** a caller provides `indexRoot` and `ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT` is also set
- **THEN** the explicit `indexRoot` SHALL win

### Requirement: Runtime index windows are complete and verifiable
The runtime hybrid retrieval index SHALL include `segments` for every index window, and every window SHALL resolve against the current structured `textbooks-v2` runtime.

#### Scenario: Index verification against structured runtime
- **WHEN** `textbook_hybrid_retrieval.py verify-index` runs against `textbooks-v2` and the canonical index directory
- **THEN** every source window SHALL exist in the structured runtime
- **AND** every owning unit SHALL resolve
- **AND** window segments SHALL close over the body
- **AND** the index manifest SHALL match the runtime source revision

### Requirement: Build and deployment scripts use the canonical index path
Build, release, and remote deployment scripts SHALL reference `resources/textbook-hybrid-retrieval/bge-m3` as the runtime retrieval index path. The raw course-runtime asset route SHALL NOT expose hybrid retrieval index files.

#### Scenario: Release preflight validates canonical path
- **WHEN** `build.sh` or `remote-deploy.sh` verifies the textbook runtime
- **THEN** it SHALL point `index_root` to the canonical path
- **AND** it SHALL fail closed when the index manifest is missing

#### Scenario: Raw runtime route blocks index files
- **WHEN** a request targets `resources/textbook-hybrid-retrieval/bge-m3/*` through the course-runtime route
- **THEN** the route SHALL return 404

### Requirement: Hybrid retrieval index generation and verification use the resource set
The hybrid retrieval index builder and verifier SHALL derive the expected textbook set and expected book count from `course-content/config/textbook-resource-set.json`.

#### Scenario: Index is built
- **WHEN** the hybrid retrieval index builder runs
- **THEN** it SHALL build windows and segments for every declared book
- **AND** the index metadata SHALL record the resourceSetId and sourceRevision used by the build

#### Scenario: Index is verified
- **WHEN** the index verifier runs
- **THEN** it SHALL compare the generated index against the declared resource set
- **AND** it SHALL fail when windows, segments, manifestHash, sourceRevision, or resourceSetId are inconsistent

#### Scenario: Explicit expected count conflicts with resource set
- **WHEN** a caller passes an explicit expected book count that differs from the resource set
- **THEN** verification SHALL fail closed
- **AND** the caller SHALL NOT bypass resource set consistency through a stale count

#### Scenario: Runtime book set diverges
- **WHEN** the runtime contains the same number of books as the resource set but its book ids differ
- **THEN** the builder and verifier SHALL fail closed
- **AND** the generated or accepted index SHALL NOT be considered consistent based on book count alone

#### Scenario: Resource set is invalid
- **WHEN** the resource set has no books or contains invalid book ids
- **THEN** the builder and verifier SHALL fail before producing or accepting an index

### Requirement: Hybrid retrieval closes over the admitted textbook corpus
The hybrid retrieval manifest SHALL bind the same resourceSetId, normalized book IDs and authoring source revision as the textbook corpus admission provenance. Its manifest identity and every per-book runtime manifest identity SHALL be verified before the external bundle is accepted. Equal book counts, shared Blob objects or a historical index SHALL NOT establish corpus consistency.

#### Scenario: Runtime and index describe the same corpus
- **WHEN** external bundle preflight validates a resource-set-complete textbook corpus
- **THEN** the hybrid index book IDs SHALL equal the provenance book IDs exactly
- **AND** its resourceSetId and authoring source revision SHALL equal the provenance and every runtime book manifest

#### Scenario: Same-count index drift occurs
- **WHEN** the hybrid index contains the same number of books but at least one book ID differs from provenance
- **THEN** bundle preparation, publication and candidate activation SHALL fail closed

#### Scenario: Historical index is present in OSS
- **WHEN** a retained or rollback Release contains a valid historical index for a different book set
- **THEN** that index SHALL remain attributable only to its immutable Release
- **AND** its OSS reachability SHALL NOT qualify it as the active corpus index

