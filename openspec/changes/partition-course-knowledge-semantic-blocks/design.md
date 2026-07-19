## Context

ADRs 0028 and 0029 require review blocks sized for roughly 40–80 identity equivalence components and prohibit splitting those components. Prototype block counts are non-gating exploratory evidence. The source contract is `docs/contexts/course-knowledge-base/CONTEXT.md`, the ADR 0015-0044 files indexed by `docs/adr/README.md`, and `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Assign each identity equivalence component to one owner block.
- Produce exhaustive non-overlapping typed exact-item lists and structured source digests.
- Record endpoint blocks and dependencies needed by later queues.

**Non-Goals:**

- Preserve any provisional block count.
- Adjudicate identity, domain membership, relations, cards, or resources.

## Decisions

### 1. Partition indivisible equivalence components

The atomic assignment unit is a globally closed identity equivalence component, not an individual source node or a mixed exact/alias/near-similar candidate group. Exact normalized-name and reviewed-alias equivalence may not cross blocks. Near-similar review edges may cross blocks and do not merge components. Pending splits remain inside their owning component.

### 2. Treat 40–80 as a validated target with narrow exceptions

Each block records `candidate_concept_count` as the number of owned equivalence components; a pending split counts once until stage-two adjudication. `exact_count` also includes relations, cards, and migration inputs and SHALL NOT be used for review capacity. Blocks outside the range require a machine-readable reason tied to an indivisible component or connectivity constraint; no prototype is grandfathered.

### 3. Freeze exact ownership and endpoint signatures

Each block record follows the shared future-child schema with typed `exact_items`, `candidate_concept_count`, one `owner_block`, applicable `endpoint_blocks`, change-ID `blockedBy`, schema/algorithm/normalization versions, separate source/governance/snapshot/upstream digests, required outputs, acceptance profile, and scope-anchor evidence. In-block relations, migration inputs, and per-component card/visual work seeds are included even when source cards are absent. A later split invalidates this closure and must regenerate exact records for every resulting canonical concept. Count-only or wildcard blocks cannot support future Buddy claims.

## Risks / Trade-offs

- [Large indivisible group exceeds capacity] → Allow a documented exception while preserving the group.
- [Optimization changes block IDs] → Bind deterministic ordering, algorithm version, and input digests.
- [Owner changes invalidate queues] → Downstream manifests must cite this partition digest and final validation rejects stale signatures.

## Migration Plan

Consume validated identity and vocabulary manifests, generate and validate exhaustive ownership, freeze the partition digest, then unlock cross-block queue derivation. Do not create future content-block changes.

## Open Questions

None; exact block count is an output of deterministic partitioning.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: Every identity equivalence component is assigned intact to one deterministic semantic owner block with typed exact-item and endpoint metadata.
Public seam: Run the partition command on fixed identity and vocabulary fixtures and validate the emitted block manifest.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic exact-leak and alias-leak fixtures fail while near-similar edges may cross blocks and pending splits stay internal; AC-2: `candidate_concept_count` enforces 40–80 owned components, counts pending split once, remains independent of `exact_count`, or records a valid exception; AC-3: a fixed real-snapshot test, byte-identical repeated runs, and no-write assertions verify typed exact items, owners/endpoints, change-ID dependencies, scope anchors, and layered digests.
Manual-only acceptance: none
Rationale: The block manifest is the public scheduling boundary for all later queues, and fixed-input command tests directly verify ownership, capacity, determinism, and exact record completeness.
