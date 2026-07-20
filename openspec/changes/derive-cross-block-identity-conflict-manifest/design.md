## Context

Partitioning owns indivisible exact-name/reviewed-alias equivalence components. Any such component crossing owner blocks is leakage and must fail; only near-similar evidence between distinct components may become a cross-block review edge. The governing identity and review rules are in `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and the observed duplicate evidence is in `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Fail exact-name and reviewed-alias component leakage across owner blocks.
- Queue every qualifying cross-block near-similar edge between distinct components with one stable identity and complete owner/endpoint metadata.
- Produce future-child records without approving outcomes.

**Non-Goals:**

- Merge, split, rename, archive, or choose canonical identities.
- Repartition equivalence components.

## Decisions

### 1. Separate hard leakage failure from review-only queueing

Exact normalized-name or reviewed-alias equivalence crossing blocks is a partition failure and is never queued. The stable near-similar edge key combines sorted distinct component IDs, owner blocks, evidence profile, and source digests. Display names are not identifiers.

### 2. Preserve all involved owner blocks

One deterministic queue owner coordinates review, while `endpoint_blocks` records every affected block. This avoids duplicate reviews without hiding impact.

### 3. Keep disposition absent until execution

Preparation records contain evidence and review requirements only. Approved outcomes belong to future content-governance children.

## Risks / Trade-offs

- [Conflict duplication] → Canonicalize member and block ordering before deriving queue IDs.
- [Stale ownership] → Require exact partition and identity source digests.
- [A queue record looks approved] → Reject disposition, canonical ID, or migration outcome fields.

## Migration Plan

Consume the validated partition and identity manifests, emit and validate the queue, and freeze its digest for relation/resource derivation and final validation. No identity migration runs.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: Exact/alias leakage fails closed, while an exhaustive deduplicated queue exposes cross-block near-similar edges between distinct components without approving any identity outcome.
Public seam: Run the cross-block identity queue generator on fixed partition and identity fixtures and validate its manifest.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic exact-leak and reviewed-alias-leak fixtures fail instead of queueing; AC-2: synthetic near-similar fixtures enqueue one deterministic edge between distinct components with one coordinator and complete endpoint blocks; AC-3: a fixed real-snapshot integration test, byte-identical repeated runs, and no-write assertions reject stale ownership, duplicates, placeholders, and approved dispositions.
Manual-only acceptance: none
Rationale: Future children consume this queue directly, so command-level reconciliation and negative fixtures verify exhaustiveness, scheduling metadata, freshness, and the no-approval boundary at the public handoff.
