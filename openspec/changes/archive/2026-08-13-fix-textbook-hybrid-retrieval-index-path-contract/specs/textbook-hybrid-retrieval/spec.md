## ADDED Requirements

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
