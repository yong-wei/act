# assessment-runtime-owner-migration Specification

## Purpose
Assessment is the sole product-runtime owner for item identity, catalog-backed selection, path and companion attempts, diagnostic and scoring reads, assessment evidence authority, and Assessment-owned generation, review, coverage, and publication tooling. Competing `src/features/adaptive-assessment` runtime ownership is retired.
## Requirements
### Requirement: Assessment is the sole product-runtime owner for assessment semantics

The product runtime SHALL assign item identity, catalog-backed assessment selection, path and companion attempts, diagnostic context, scoring/mastery reads, and assessment evidence authority to the Assessment domain and SHALL expose them through the existing Assessment public/application boundary.

#### Scenario: A runtime caller needs an assessment capability

- **WHEN** a route, worker, or product feature selects an item, reads attempt/diagnostic state, submits an answer, or reads assessment evidence
- **THEN** it SHALL depend on an Assessment public API, application use case, or declared Assessment port
- **AND** it SHALL not import an implementation path under a competing adaptive-assessment owner.

#### Scenario: A source file has mixed ownership evidence

- **WHEN** catalog, item, attempt, evidence, or diagnosis code has both Assessment and adaptive-assessment callers
- **THEN** the migration SHALL record the current consumers and assign one Assessment target owner
- **AND** it SHALL not infer ownership from directory name alone.

### Requirement: Runtime and assessment toolchain concerns are explicitly separated

Assessment-owned generation, semantic review, coverage, and publication tooling SHALL remain traceable to their source lineage and human-review authority while remaining separate from request-time runtime dependencies.

#### Scenario: A generation or review command runs

- **WHEN** a tool builds candidates, review packets, coverage, or a catalog publication
- **THEN** it SHALL import the declared Assessment toolchain boundary and preserve candidate lineage, review decision, source hash, and publication identity
- **AND** it SHALL not make an unreviewed or in-memory candidate a runtime path-eligible item.

#### Scenario: A request-time catalog read runs

- **WHEN** a product request resolves a reviewed item or immutable item snapshot
- **THEN** it SHALL use the Assessment runtime read contract
- **AND** it SHALL not load generation/review writers, command-only filesystem mutation, or a second catalog authority.

### Requirement: All Assessment consumers migrate before obsolete runtime paths are deleted

The implementation SHALL migrate every current production route, worker, script, dynamic load, re-export, and relevant test consumer of an adaptive-assessment runtime path before deleting that path, and SHALL preserve explicit historical/test-only classifications.

#### Scenario: A post-migration import graph is clean

- **WHEN** the exact intended revision is scanned after consumer migration
- **THEN** every retired adaptive-assessment runtime path SHALL have zero production imports, dynamic loads, and re-exports
- **AND** any remaining test or historical reference SHALL be explicitly classified and shall not keep a production file alive.

#### Scenario: A production consumer remains

- **WHEN** a route, worker, script in the production/tools graph, or dynamic load still reaches a retired runtime path
- **THEN** deletion SHALL fail closed
- **AND** the path SHALL remain an unresolved migration record until that consumer is moved and rescanned.

### Requirement: Ownership migration preserves the existing Assessment contracts

Moving Assessment runtime ownership SHALL preserve the already qualified attempt, catalog, persistence, generation-review, privacy, and evidence contracts, including server-derived identity, reviewed eligibility, immutable item snapshots, idempotent durable writes, error behavior, and response compatibility.

#### Scenario: An existing assessment request is replayed

- **WHEN** a learner retries a next-question or answer request with the same action identity
- **THEN** the result, durable identity, ordering, and duplicate-prevention behavior SHALL remain equivalent to the pre-migration characterization
- **AND** no in-memory or legacy fallback authority SHALL be introduced.

#### Scenario: Historical assessment data is read

- **WHEN** an old item reference, answer, LearningFact, or publication record is read after the source move
- **THEN** it SHALL remain readable through its owning Assessment adapter or declared historical owner
- **AND** the migration SHALL not rewrite, delete, or reinterpret historical identity.

### Requirement: Assessment owner migration is non-deploying and schema-neutral

This change SHALL be limited to source ownership, consumer imports, tests, and architecture evidence; it SHALL not alter Prisma schema, production data, runtime releases, selectors, deployment state, or external coordination.

#### Scenario: Migration is qualified locally

- **WHEN** ownership and zero-import evidence pass
- **THEN** the result MAY be archived as a code/governance change
- **AND** it SHALL not imply production deployment, data migration, or selector activation.

