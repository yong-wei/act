## Context

ADR 0045 replaces the former full-history inventory boundary. Stage one requires enough truth to rebuild the current knowledge base and migrate active references, not enough information to reproduce every historical producer or derived learner state.

## Goals / Non-Goals

**Goals:**

- Freeze the five authoritative input classes from the shared scope contract.
- Preserve typed namespaces, source digests, reviewed scope anchors, and snapshot proof for active database references.
- Reject out-of-scope historical inputs without generating or maintaining a diagnostic catalog.

**Non-Goals:**

- Historical event replay, `LearningFact` backfill, source-lineage reconstruction, evidence deduplication, or learner-state reconciliation.
- Full-root AST writer equality or complete historical decoder closure.
- Semantic admission, identity, domain, relation, card, or binding decisions.

## Decisions

### 1. Inventory only current truth and active references

Repository sources are current formal-course anchors, current authoring content/cards/media/resources, and current published graph/binding projections. Database sources contain only references still read or continued by current business behavior: course/resource links, progress, notes, and incomplete paths.

### 2. Reject historical diagnostic scope

This series does not generate, consume, or validate historical fact/event shapes, decoder coverage, lineage, writers, portraits, diagnoses, risks, growth, recommendations, class aggregates, or Arena records. If supplied as inventory inputs, they are rejected as out of scope and cannot create missing-input, unknown-shape, or readiness findings.

### 3. Preserve historical interpretation

Historical facts retain their original graph revision. Facts without a provable revision use `legacy-unversioned` or a legacy snapshot; the inventory never maps them to current truth.

## Risks / Trade-offs

- [An active reference is misclassified as history] → Require an explicit business reader/continuation reason and active/inactive disposition.
- [Historical inputs enter the bounded inventory] → Reject their item kinds before readiness evaluation; do not build a parallel catalog.
- [Source data drifts] → Bind source and snapshot digests and report expected/observed drift.

## Testing Strategy

Change class: medium-risk
Seam status: required
Public behavior: A deterministic read-only manifest exposes the bounded governance inputs and active-reference dispositions.
Public seam: Run the inventory CLI on synthetic fixtures and a fixed current snapshot.
Existing seam reused: OpenSpec/Buddy validators only; the inventory CLI is new.
AC coverage: synthetic fixtures verify all five authoritative classes, completed/incomplete path classification, out-of-scope input rejection, snapshot proof, namespace separation, missing inputs, deterministic output, and no writes; a fixed snapshot test reports observed counts and drift without historical trajectory fixtures.
Manual-only acceptance: none
Rationale: command-level validation directly checks the manifest consumed downstream.
