## Context

Teacher review has a queue, review workspace, grade workspace, and grading
console.  They present assignment/submission context, current attempts,
machine drafts, teacher criteria and annotations, approval/return/release
actions, completeness blockers, and governed evidence status.  After C16, all
commands enter Assignment while Assessment and Learning Record retain their
owners.

The `code-simplification` workflow requires understanding these callers and
state transitions before editing, applying incremental behavior-preserving
changes, and rejecting cleverness or file-only movement.

## Goals / Non-Goals

**Goals:**

- Reduce repeated state/action/rendering logic across teacher review surfaces.
- Preserve lineage, authorization, teacher approval, score authority,
  completeness, partial feedback, outbox, privacy, and recovery behavior.
- Preserve queue/workspace loading, empty, stale, conflict, processing,
  blocked, saved, approved, returned, released, and error states.
- Produce auditable before/after simplification evidence.

**Non-Goals:**

- Changing Assignment review/grading API, Assessment attempt semantics, Learning
  Record/evidence contracts, scoring formulas, or database state.
- Adding a shared UI state framework, a second grading state machine, or a
  route-specific authority.
- Letting AI approve, publish feedback, set final totals, or write evidence.
- Completing the work through file splitting or styling changes only.

## Decisions

### 1. Baseline the complete review state machine

Record queue filters, open/reload, lineage and authorization failures, current
attempt selection, machine/teacher criterion values, annotation edits, save
version conflicts, approve/return/release transitions, completeness blockers,
partial feedback, outbox states, evidence limitations, and keyboard/focus
behavior.  Capture representative ordinary, stale, missing, processing,
conflicting, and unauthorized cases.

### 2. Simplify duplicated UI transitions

Use named selectors/predicates and guard clauses for review availability,
current-attempt completeness, and action permissions.  Deduplicate identical
request status/error mapping and queue/workspace projection branches only when
their Assignment scope, CAS, idempotency, and side effects match.  Keep
approval, return, release, partial, and final-total states explicit.

### 3. Keep teacher approval and AI boundaries visible

The workspace sends commands through Assignment's existing API.  Teacher
criterion values and immutable approval snapshots remain the sole score
authority; AI machine criteria, confidence, comments, and draft totals remain
advisory provenance.  The UI never writes LearningFact or bypasses the
approved-snapshot governance port.

### 4. Preserve completeness and partial-feedback distinctions

The simplified projection continues to block a final assignment total when a
required current attempt is missing, stale, processing, returned, or
unapproved.  Approved question feedback may be released independently and is
shown as partial without becoming a final grade.

### 5. Measure clarity rather than movement

Record before/after lines, components/functions, branches/state transitions,
duplicate request/render paths, imports, and behavior/privacy/accessibility
results.  Extracted files count only when a concrete duplication or reasoning
burden is removed.

## Risks / Trade-offs

- [Approval and release actions are merged] → compare command identity,
  idempotency, CAS, outbox state, and role permissions separately.
- [AI draft appears authoritative after render cleanup] → assert labels,
  field provenance, and server approval requirements.
- [Incomplete current attempt exposes a total] → retain blocker selectors and
  tests for every existing completeness reason.
- [Teacher sees data outside class/grant scope] → preserve server API
  authorization and role-safe DTO tests.
- [Simplification hides recovery actions] → run keyboard/focus and all
  recoverable-state acceptance tests.

## Migration Plan

1. Freeze the review state machine, callers, complexity, and UI/API baseline.
2. Apply one code-simplification transformation at a time to queue/workspace/
  console projections and action handling.
3. Compare lineage, authorization, approval, scoring, partial release,
  evidence, outbox, and accessibility behavior.
4. Record after metrics and disposition for each transformation.
5. Revert any transformation that changes authority or increases cognitive
  burden; no data migration is involved.

## Open Questions

None.  The implementer chooses the smallest clear transformation supported by
the baseline and existing contracts; no target line count is prescribed.
