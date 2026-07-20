## Context

The audit records raw relations, but deduplicated adjudication-unit and cross-block counts are not yet reproducible contract inputs and cannot be frozen before partition and cross-identity manifests. Relation constraints are defined by `docs/contexts/course-knowledge-base/CONTEXT.md`, ADRs 0019–0024 and 0028–0029 within the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Derive every cross-block relation adjudication unit after ownership stabilization.
- Preserve raw provenance and typed endpoint signatures that reference candidate identity component IDs.
- Emit exact future-child queue records.

**Non-Goals:**

- Approve relation family, direction, directness, compatibility, rationale, or release eligibility.
- Write canonical relations to authoring or runtime data.

## Decisions

### 1. Queue deduplicated adjudication units, not raw edges

Raw IDs remain provenance, while one normalized candidate-component endpoint/family signature defines the review unit. This preserves the dated audit source evidence without claiming canonical endpoint completion or turning snapshot counts into permanent requirements.

### 2. Derive cross-block status from frozen owners

No provisional block count is carried forward. Every endpoint resolves through partition and cross-identity manifests before queue inclusion.

### 3. Treat three relation families as candidates only

`contains`, `prerequisite`, and `association` are allowed candidate families, but execution must still adjudicate direction, evidence, directness, acyclicity, and compatibility.

## Risks / Trade-offs

- [Endpoint identity changes] → Bind identity, partition, and cross-identity digests.
- [Raw provenance is lost during deduplication] → Require a non-empty complete source relation ID list per unit.
- [Candidate family is mistaken for approval] → Omit approval fields and label the field as proposed family.

## Migration Plan

Consume frozen upstream manifests, derive and reconcile queue units, freeze the queue digest, and pass it to final validation. No relation migration or release occurs.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: A complete deduplicated cross-block relation review queue preserves all raw provenance and exact endpoint ownership without approving relations.
Public seam: Run the new relation manifest CLI on synthetic fixtures and a fixed real snapshot, then validate candidate-component endpoints and raw provenance.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic fixtures preserve every raw source ID while deduplicating typed signatures whose endpoints reference candidate component IDs; AC-2: a fixed real-snapshot integration test reports observed raw and deduplicated counts with derivation metadata, without assuming unsupported expected totals; AC-3: repeated runs are byte-identical and no-write assertions reject stale endpoints, unknown families, missing owners, duplicates, placeholders, and approved outcomes.
Manual-only acceptance: none
Rationale: The emitted queue is the public review handoff, so full provenance reconciliation and negative fixture validation directly cover completeness, ownership freshness, and the no-approval boundary.
