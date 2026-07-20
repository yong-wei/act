## Context

The audit records exact-name conflict groups, while reviewed aliases and near-similar edges are not frozen. Identity rules are defined in `docs/contexts/course-knowledge-base/CONTEXT.md` and ADRs 0015, 0029, 0030, 0034, 0035, and 0040 within the ADR 0015-0044 files indexed by `docs/adr/README.md`; audit evidence is in `docs/knowledge-graph-current-state-audit-2026-07-18.md`.

## Existing entry point

Existing entry point: none. A later implementation of this change must add a new read-only manifest CLI; this proposal does not claim a governance CLI already exists.

The CLI contract follows docs/proposals/course-knowledge-base-governance-source-derivation-contract.md: versioned normalization, canonical ordering, path and newline normalization, deterministic missing-file records, separate governance/source/upstream digests, per-source and aggregate digests, expected/observed drift, synthetic fixtures, fixed real-snapshot integration tests, byte-identical repeated runs, and no-write assertions.

## Goals / Non-Goals

**Goals:**

- Build globally closed identity equivalence components from exact normalized names and reviewed controlled aliases only.
- Emit near-similar review edges only between different components.
- Keep pending split as an internal component disposition with intact membership and historical evidence; block ownership does not exist until partitioning.
- Attach candidate-to-scope-anchor evidence references from inventory sources without approving formal-course admission.

**Non-Goals:**

- Approve merges, splits, renames, archives, or canonical IDs.
- Use similarity scores as identity truth.

## Decisions

### 1. Separate deterministic and heuristic evidence

Exact normalized names and reviewed controlled aliases are the only hard-equivalence evidence. Their transitive closure forms one indivisible component with a stable `component_id`. Near-similar analysis connects two distinct components for review only and never merges them. `owner_block` is absent here and is first assigned by partitioning.

### 2. Represent unresolved outcomes explicitly

Each component records members, exact/alias evidence, pending internal split alternatives, historical mapping slots, and references to inventoried `course-scope-anchor/v1` evidence. A pending split does not pre-split membership or historical evidence. Near-similar records remain separate review edges between components; identity generation neither extracts new anchors nor decides formal-course admission.

### 3. Preserve global grouping before partitioning

Identity equivalence components are globally closed and indivisible downstream. Partition-first alternatives are rejected because they permit exact-name or reviewed-alias leakage; owner blocks are deliberately assigned only by the downstream partition.

## Risks / Trade-offs

- [Near-similar recall is incomplete] → Record algorithm/version and require coverage checks without treating scores as decisions.
- [A mixed source node implies one-to-many history] → Preserve explicit split-pending mapping rather than copying evidence.
- [Group IDs drift] → Derive stable IDs from canonicalized member/evidence signatures and bind the inventory digest.

## Migration Plan

Consume only the validated inventory, emit the candidate manifest, validate exhaustive membership and stable digests, then pass it to partitioning. No canonical migration executes in this change.

## Open Questions

None; semantic outcomes remain intentionally pending for future review children.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: A deterministic global manifest exposes globally closed exact/alias equivalence components, internal pending splits, and review-only near-similar edges between distinct components.
Public seam: Run the new identity manifest CLI on synthetic fixtures and a fixed real snapshot, then validate component closure, absence of pre-partition owners, scope-anchor evidence, review edges, and mapping records.
Existing seam reused: none for the governance manifest CLI; implementation must add a new read-only manifest CLI. Existing OpenSpec/Buddy validators may be reused only for proposal shape.
AC coverage: AC-1: synthetic closure fixtures keep exact/alias-equivalent records in one stable component and reject any pre-partition `owner_block`; AC-2: near-similar fixtures enqueue one deterministic edge between distinct components without merging, pending splits remain internal, and scope anchors remain evidence rather than admission truth; AC-3: a fixed real-snapshot test records observed counts as dated evidence, repeated runs are byte-identical, and no-write assertions cover all governed surfaces.
Manual-only acceptance: none
Rationale: Consumers use the emitted manifest, making command-level fixed-input validation the highest seam for exhaustiveness, determinism, and preservation of unresolved identity decisions.
