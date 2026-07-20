## ADDED Requirements

### Requirement: The inventory closes the editable, projection, reference, and entry-point inputs
The inventory SHALL enumerate every source-registry entry, including formal objectives and explicit anchor-source references, course structure and orchestration, lesson authoring content, independent resource authoring under `course-content/authoring/resources/**`, runtime consistency evidence, historical knowledge references, derived learner-state datasets, loaders, direct-write APIs, and seed/sync scripts. It SHALL NOT assign a concept candidate to a `formal_objective`, `necessary_prerequisite`, or `explicit_extension` anchor.
Every existing scope anchor SHALL be emitted as a stable `course-scope-anchor/v1` record containing `anchor_id`, `anchor_scope`, `anchor_type`, course/module/lesson identities, `source_locator`, and `text_digest`. `anchor_scope: course` SHALL require null module and lesson identities; `anchor_scope: module` SHALL require a module identity and null lesson identity; `anchor_scope: lesson` SHALL require both identities. Empty strings and synthetic hierarchy identities SHALL fail validation. Course, module, lesson, lesson item, resource, container, activity, assessment, citation, source, and runtime projection SHALL use separate identity namespaces. Authoring multimedia semantics and runtime media projection records SHALL remain separate and reconcile one-to-one where applicable.

#### Scenario: An anchor uses an invalid nullable scope matrix
- **WHEN** an anchor scope and its module or lesson identity do not match the declared course/module/lesson null matrix
- **THEN** inventory readiness SHALL fail without synthesizing a hierarchy identity.

#### Scenario: Authoring and runtime represent the same lesson
- **WHEN** both source families are inventoried
- **THEN** authoring SHALL be marked editable truth and runtime/review results SHALL be projection-consistency evidence
- **AND** their records SHALL NOT be merged into one cardinality.

#### Scenario: An interactive step contains teaching, activity, and checkpoint content
- **WHEN** its authoring and runtime sources are inventoried
- **THEN** each source family SHALL remain independently addressable for downstream recursive atomic segmentation
- **AND** no course, activity, assessment, or media identity SHALL collapse across namespaces.

#### Scenario: A planning or runtime source resembles instructional content
- **WHEN** BOPPPS, interactive design/contract, acceptance/review, or runtime projection records are inventoried
- **THEN** their planning, gate, or projection source role SHALL be explicit
- **AND** they SHALL NOT be classified as binding-content truth.

#### Scenario: Canonical cards and media variants are inventoried
- **WHEN** canonical card/sequence files or raw, processed, and runtime media are present
- **THEN** cards and processed media SHALL be authoring binding content, sequences SHALL be planning evidence, raw media SHALL be provenance, and runtime artifacts SHALL be projection evidence
- **AND** every source-role glob SHALL report hit counts, unclassified files, and multiply classified files without using counts as permanent constants.

### Requirement: Inventory normalization and digests are reproducible
Every source SHALL use versioned schema, algorithm and normalization profiles; Unicode NFC; repository-relative POSIX paths; LF/UTF-8 normalization; canonical typed-record sorting; deterministic missing-file records; per-source digests; `governance_contract_digest`; and `source_snapshot_digest`.

#### Scenario: A declared source drifts
- **WHEN** an expected digest or cardinality differs from the observed snapshot
- **THEN** the report SHALL identify the source and emit structured `expected` and `observed` values
- **AND** downstream readiness SHALL fail without synthesizing replacement data.

### Requirement: Learner data is minimized
Repository manifests SHALL contain only dataset-level schema/version, counts, shape/schema digests, and small-cell-suppressed de-identified aggregate disposition statistics. They SHALL exclude user IDs, raw answers, event payloads, risk descriptions, portrait prose, raw-row digests, and reversible row-level migration keys. Repository fixtures SHALL be wholly synthetic and structurally equivalent; real historical payload validation SHALL run only against the controlled database snapshot and SHALL emit only shape/version/error codes and suppressed counts.
Repository learner-data digests SHALL cover only schema, counts, and small-cell-suppressed aggregate disposition statistics, never raw rows or low-entropy individual values. All database datasets SHALL bind one immutable export or one read-only repeatable-read snapshot with `snapshot_id`, `captured_at`, and dataset watermarks.
The `snapshot_id` SHALL be derived from either an immutable export object and aggregate digest, or the actual transaction isolation, start time, and shared exported-snapshot token. Caller-provided labels SHALL NOT establish consistency.

#### Scenario: Tests cover learner datasets
- **WHEN** inventory fixtures exercise learner reference surfaces
- **THEN** fixtures SHALL be wholly synthetic
- **AND** row-level migration keys and outcomes SHALL remain database-side audit data.

### Requirement: Registry schema and direct-writer closure fail closed
Every declared Prisma table and field SHALL exist in the current DMMF. Versioned decoder contracts SHALL define machine-readable selectors, namespaces, explicit parent/source joins or a justified non-applicability marker, closed discriminator mappings, schema sources, digest rules, and fail-closed handling for historical paths, full `LearningFact.contextJson` including nested evidence governance and immutable knowledge-revision references, `InteractionLog.eventData`, and `LearningEventBatch.events`. Every schema-source fragment SHALL resolve to a real symbol or schema key, and every join endpoint SHALL exist both in DMMF and the declared database-source field set. Full-production-root AST mutation and producer discovery SHALL cover knowledge nodes/links, lesson knowledge references, resource bindings, interaction logs, event batches, knowledge progress/notes, learning paths/executions/deviations/interventions, and learning facts, and its writer-path set SHALL exactly equal the source registry direct-writer set. Every LearningFact producer SHALL also reconcile `sourceLogId`/`sourceEventId` namespace and active immutable knowledge revision against the closed registries.

#### Scenario: A writer or field exists on only one side
- **WHEN** DMMF or mutation-callsite reconciliation runs
- **THEN** inventory readiness SHALL fail with structured expected and observed sets.

#### Scenario: An event replay or historical path contains an unknown ID-bearing shape
- **WHEN** the versioned decoder cannot assign a declared namespace
- **THEN** an unresolved record SHALL be emitted and readiness SHALL fail
- **AND** no old knowledge identity SHALL be replayed or guessed.

### Requirement: Learner aggregate publication suppresses small cells
Repository outputs SHALL use `min_group_size: 5`, suppress smaller cells, merge or suppress rare categories, and reject cross-dimensional combinations that produce a smaller cell. Raw risk descriptions, portrait/recommendation prose, learner keys, and row digests SHALL remain database-side only.

#### Scenario: A synthetic class has fewer than five learners
- **WHEN** aggregate disposition statistics are emitted
- **THEN** the value SHALL be `suppressed` rather than the underlying count.
