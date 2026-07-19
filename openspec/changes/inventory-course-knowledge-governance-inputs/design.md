## Context

Downstream identity, partition, relation, and resource manifests need one immutable account of what was inspected. The source vocabulary and governance decisions come from `docs/contexts/course-knowledge-base/CONTEXT.md` and the ADR 0015-0044 files indexed by `docs/adr/README.md`; the current counts and source distinctions come from `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Enumerate the complete course authoring closure, runtime projection evidence, historical reference surfaces, database-side row-audit datasets, consumers, direct-write APIs, loaders, and seed/sync scripts.
- Record schema/version, deterministic hash, record cardinality, and missing-input status.
- Provide digest-bound inputs for every downstream manifest.

**Non-Goals:**

- Group identities, assign domains or owners, normalize relations, or approve resource bindings.
- Modify or synthesize missing source data.

## Decisions

### 1. Inventory physical sources and logical record sets separately

A file can contain several logical record types, while one logical dataset can span files. Recording both prevents a file hash from hiding cardinality omissions.

### 2. Fail closed on missing or unreadable inputs

Missing inputs remain explicit records with expected path and reason. Silently skipping them would make downstream completeness unverifiable.

### 3. Preserve authoring truth, projection evidence, history, and privacy boundaries

The machine-readable source registry fixes repository globs, exclusions, database fields, versioned decoder contracts, namespaces, and missing policies. Prisma DMMF validates every declared table/field, and full-root AST mutation/producer discovery must equal the declared direct-writer set. The complete authoring closure is editable truth; multimedia designs, lesson manifests and both interaction acceptance files are authoring governance inputs, while review/export scripts are projection producers. Lesson and knowledge runtime artifacts are separate projection-consistency sources and never merge into authoring cardinality. Historical references include LearningNote, path execution/terminal metadata, nested LearningFact governance references, and replayable interaction/event-batch payloads; unknown ID-bearing shapes fail closed. Scope anchors are stable nullable-scope evidence records, not admission decisions. Learner datasets include diagnosis snapshots and come from one proved immutable export or shared read-only repeatable-read snapshot; repository artifacts contain only schema, counts, and small-cell-suppressed aggregate dispositions—never row content, event payloads, or row digests.

## Risks / Trade-offs

- [Non-deterministic serialization changes hashes] → Define canonical ordering and content hashing per schema version.
- [A source exists but records are omitted] → Reconcile per-source cardinality with aggregate counts.
- [Inventory becomes a semantic decision] → Limit fields to provenance, schema, hash, count, stable anchor evidence, and missing status.
- [Registry silently drifts from the application] → Compare Prisma DMMF and statically discovered writers bidirectionally.

## Migration Plan

Generate the inventory from a clean repository plus one consistent database snapshot, record snapshot metadata and watermarks, validate registry/count/digest closure, then freeze its aggregate source digest for dependent changes. No production deployment applies.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: A complete reproducible input inventory exposes every in-scope source, version, digest, cardinality, and missing-input finding without semantic judgments.
Public seam: Run the inventory command against a fixed repository fixture and validate its emitted manifest schema, aggregate counts, and source digest.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: wholly synthetic fixtures prove the complete authoring, runtime-evidence, history, consumer/writer/loader/script, privacy, and database-audit boundaries; AC-2: a fixed real-repository snapshot integration test reports versioned observed counts and expected/observed drift without making counts permanent; AC-3: repeated runs are byte-identical and no-write assertions cover sources, runtime, database, Git, and GitHub.
Manual-only acceptance: none
Rationale: The emitted manifest is the public handoff to all downstream children, so synthetic and fixed-snapshot command tests directly cover completeness, privacy, reproducibility, and the no-semantic-judgment boundary.
