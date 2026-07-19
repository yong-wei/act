## Context

The future rebuild series must not be created from prototype block names, mutable endpoint counts, or placeholders. This final child validates all preparation outputs against `docs/contexts/course-knowledge-base/CONTEXT.md`, all accepted decisions in the ADR 0015-0044 files indexed by `docs/adr/README.md`, and baseline evidence in `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Prove schema, digest, ownership, coverage, and dependency closure across all manifests.
- Produce exact self-contained future-child records.
- Establish an explicit creation gate for the second-stage Buddy series.

**Non-Goals:**

- Resolve identity, domain, relation, resource, card, or migration decisions.
- Create second-stage OpenSpec changes or release production data.

## Decisions

### 1. Validate closure from the inventory outward

Every source record must terminate in a declared owner or explicit typed non-governance disposition. Aggregate counts alone cannot prove coverage.

### 2. Require exact future-child records

Each record contains `change_id`, `work_kind`, `schema_version`, `algorithm_version`, `normalization_profile`, `exact_count`, structured `exact_items`, applicable `candidate_concept_count`, applicable `owner_block`, complete cross-block `endpoint_blocks`, change-ID `blockedBy`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, `required_outputs`, `acceptance_profile`, and `scope_anchor_ids`. Each exact item contains `item_kind`, `identity_namespace`, `source_id`, and `source_digest`; `exact_count` equals the number of typed records. Duplicate checks use `(item_kind, identity_namespace, source_id)`, so equal strings in different namespaces remain distinct. Stage one includes per-component card/visual work seeds; stage two requires separate card and visual-suitability records for each final concept and regenerates closure after every split.

Field applicability is discriminated by `semantic_block`, `cross_identity`, `cross_relation`, `resource_binding`, `global_closeout`, and `cutover`: owners are required only where applicable, and every cross-block record requires complete endpoints. Dependencies reference declared change IDs.

Acceptance profiles form a closed work-kind registry. Semantic blocks emit an eight-field accepted semantic profile before card work, then finish cards before in-block relations. Cross-identity, cross-relation, and resource-binding records must be blocked by every endpoint semantic-block change and consume its named accepted profile output; general acyclicity alone is insufficient.

### 3. Validate executable-source closure before readiness

Prisma DMMF must contain every registry table/field, JSON selectors must accept only known shapes, transaction/export proof must establish one database snapshot, learner aggregates must suppress cells smaller than five, and statically discovered writer paths must equal declared direct writers. These checks precede cutover disposition validation.

### 4. Reject all placeholders and stale digests

Wildcard IDs, ranges, TODO values, provisional owners, unresolved digest markers, and missing upstream bindings are fatal. No waiver or `--allow-missing` mode exists.

## Risks / Trade-offs

- [A valid empty queue is confused with missing data] → Require explicit zero count, empty typed exact list, complete structured digests, and derivation evidence.
- [Dependency graph is cyclic or references absent children] → Validate graph closure and acyclicity.
- [Validation is mistaken for governance completion] → Output only creation readiness; prohibit content decisions and production release artifacts.

## Migration Plan

Run the validator over all frozen preparation manifests, emit a deterministic validation report and exact future-series manifest, and independently review them. Only then may a separate propose operation create the second-stage parent and exact children. No production deployment applies.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: Validation accepts only a complete digest-closed, ownership-closed, dependency-closed, placeholder-free exact future-series manifest.
Public seam: Run the series-manifest validator against complete and adversarial manifest fixtures and inspect its exit status and deterministic report.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic fixtures cover all six work kinds, typed items/counts, per-component card/visual closure, namespace collisions, field applicability, DMMF drift, JSON decoders, writer equality, snapshot proof, owners, endpoints, outputs, acceptance profiles, anchors, privacy suppression, dependencies, and no-waiver rules; AC-2: a fixed real-snapshot full-series integration test verifies layered digests and expected/observed drift; AC-3: repeated runs are byte-identical and no-write assertions prove the validator creates no source, database, Git, GitHub, OpenSpec, or stage-two state.
Manual-only acceptance: none
Rationale: Validator exit status and report are the highest public gate before future series creation, and complete plus adversarial fixtures directly exercise every acceptance condition and prohibited shortcut.
