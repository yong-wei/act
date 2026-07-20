## Context

Knowledge-reference projection and resource-endpoint totals are inventory outputs rather than assumed audit constants. The source model must separate twelve entity types, mutually exclusive atomic boundaries, derived container summaries, four canonical instructional-role values, unresolved boundaries, and external identity namespaces under `docs/contexts/course-knowledge-base/CONTEXT.md`, ADRs 0025–0026, 0033, and 0043 within the ADR 0015-0044 files indexed by `docs/adr/README.md`, plus `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Enumerate all twelve entity types and recursively derive non-overlapping leaf units from eligible handout sections, authored resources, reconciled actual interactive content/activity/checkpoint records, exercises/questions, authored media segments, and knowledge cards. BOPPPS, interactive design/contract, acceptance/review, and runtime files provide planning, gate, or projection evidence only and never directly create a binding candidate.
- Derive role-specific review candidates with candidate component endpoints and exact owner/endpoint blocks.
- Preserve unresolved boundaries as incomplete and derive container coverage only from atomic children.

**Non-Goals:**

- Approve or publish resource bindings.
- Treat container coverage as an independently maintained binding.
- Modify resource registry, TeachingResource, authoring, runtime, or evidence data.

## Decisions

### 1. Use atomic resources as binding review units

Segmentation walks containers recursively and creates non-overlapping sibling leaves for every independently meaningful content block, activity, checkpoint, question, or media segment. A parent becomes a derived container after its leaves are assigned; static teaching content is not swallowed when a sibling activity or assessment exists. A long document with no locatable internal unit may be one atomic `teaches` unit, but it cannot produce fine-grained `assesses` evidence. Containers carry only derived summaries linked to ordered atomic children.

The source-role matrix is mandatory. BOPPPS teacher-progression prose and multimedia/interactive plans may supply objective, order, feedback, and review evidence but are not resources. Authoring interactive page, contract, runtime manifest, page check, implementation acceptance, and manifest audit must reconcile step identity, interaction archetype, order, feedback, and progression before one normalized actual activity or assessment record becomes eligible. Drift, failed hard gates, duplicated prompts, missing feedback, or degradation of drag/link/exploration behavior to static, single-choice, or mechanical fill-in output produces an unresolved or blocked record and no formal binding candidate.

### 2. Use only canonical instructional-role values

Candidates use only `teaches`, `practices`, `assesses`, or `references`, with documented Chinese display mappings; legacy explaining semantics map to `teaches`. Each role has a distinct evidence schema for explanatory locator, learner action/output, observable criterion/scoring source, or citation-only locator. Interactive units also retain feedback, misconception, teacher aggregation, and progression semantics. `atomic_unit` and `binding_candidate` are separate typed records: every unit appears once with closed student/teacher/shared audience and visibility, while zero or more candidates use key `(atomic_unit_id, component_id, role)`; unresolved role is a separate review record. Teacher-only units never enter student paths, recommendations, or visible card-resource lists. Raw media is provenance, processed media is authoring binding content, and runtime media is projection evidence.

### 3. Preserve typed identity namespaces and projection truth boundaries

Course/module, lesson/item, resource/container, registry/runtime, assessment/activity, and citation/source identities remain typed external endpoints. Equal strings in different namespaces remain distinct. Authoring cards and multimedia designs are editable truth; runtime cards, sequence, media indexes and service files provide projection-consistency evidence. Candidate component IDs are endpoints only and are not finalized canonical identities. Learner-linked repository artifacts contain only schema, counts, and small-cell-suppressed aggregate dispositions; raw rows and row digests remain database-side.

## Risks / Trade-offs

- [Atomic boundaries are unavailable] → Emit an explicit unresolved boundary record, not a container binding.
- [Endpoint signatures move with identity ownership] → Bind partition and cross-identity digests.
- [Role inference appears authoritative] → Preserve provenance/confidence as candidate evidence and prohibit approval fields.

## Migration Plan

Consume validated inventory, partition, and cross-identity manifests; derive atomic/container/external identity records and review candidates; reconcile all inventoried records; freeze the queue digest. No resource migration runs.

## Open Questions

None.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: A complete resource review manifest separates typed atomic units from derived container summaries, preserves unresolved boundaries, and emits only canonical role candidates against candidate component endpoints.
Public seam: Run the new resource manifest CLI on synthetic split-matrix/privacy fixtures and a fixed real snapshot.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic fixtures cover all entity types, recursive sibling splits, mixed teaching/activity/checkpoint steps, canonical role evidence, interaction feedback/progression, namespace collisions, unresolved boundaries, container derivation, card/media consistency, and privacy rejection; AC-2: a fixed real-snapshot integration test reports observed projection/endpoint counts with derivation metadata; AC-3: repeated runs are byte-identical and no-write assertions reject stale candidate endpoints, independent container truth, unresolved-as-complete records, placeholders, and approved outcomes.
Manual-only acceptance: none
Rationale: The emitted manifest is the public scheduling input for resource review children, so command-level reconciliation and negative fixtures directly verify coverage, identity isolation, role semantics, and the no-approval boundary.
