## Context

The current graph presents labels across incompatible dimensions, while the target governance model requires a flat controlled vocabulary. The terminology and constraints are in `docs/contexts/course-knowledge-base/CONTEXT.md`, ADRs 0017, 0018, 0032, 0041, and 0045 within the ADR 0015-0045 files indexed by `docs/adr/README.md`, and the mixed-dimension evidence is in `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Derive flat domain candidates with stable candidate IDs, unique proposed names, definitions, inclusion boundaries, and exclusion boundaries.
- Preserve any declared candidate seeds only as non-binding versioned evidence.
- Derive deterministic dimension-pollution review records for observed labels without assigning concepts or owners.

**Non-Goals:**

- Assign candidate concepts to domains.
- Introduce domain hierarchy, course modules, or navigation constructs as domains.

## Decisions

### 1. Keep candidate output flat and non-final

Observed labels and any separately declared seed set may inform candidate derivation, but no count is a success condition. Child-domain trees are rejected because concept `contains` relationships already carry semantic hierarchy; final domain cardinality and approval remain future review outcomes.

### 2. Model migration by source dimension

Each old value is classified as semantic domain, course structure, navigation/topic filter, or invalid/unknown. This preserves information without promoting polluted dimensions into domains.

### 3. Separate vocabulary validity from membership

This change defines allowed terms and migration rules only. Assigning concepts here would conflict with identity grouping and partition ownership.

## Risks / Trade-offs

- [A label has mixed meaning] → Emit an explicit review-required migration disposition, not a guessed domain.
- [Seed or observed counts drift] → Report dated expected/observed evidence without fixing final cardinality.
- [Course organization leaks into ontology] → Negative fixtures reject module, lesson, overview, and rapid-track dimensions as domains.

## Migration Plan

Derive candidate records and the dimension-pollution review list from the versioned evidence, freeze their digests, and provide them to partitioning. No runtime metadata migration or concept-domain assignment occurs here.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: A flat non-final domain-candidate manifest and dimension-pollution review list can be consumed without assigning any concept or fixing final cardinality.
Public seam: Run the new domain-candidate manifest CLI against synthetic observed-label fixtures and a fixed real snapshot.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic fixtures prove candidate-name uniqueness, flatness, pollution classification, and rejection of concept membership/owner fields; AC-2: a fixed real-snapshot test derives observed labels and records any declared seeds only as dated non-binding evidence; AC-3: repeated runs are byte-identical and no-write assertions cover authoring, runtime, database, Git, and GitHub.
Manual-only acceptance: none
Rationale: The vocabulary manifest is the complete public input to partitioning, so direct schema and observed-label fixture validation covers its cardinality, boundaries, migration semantics, and no-assignment boundary.
## ADR 0045 Boundary

Historical evidence may not expand the controlled vocabulary or admit a candidate. Only current governed course truth and reviewed anchors participate in derivation.
