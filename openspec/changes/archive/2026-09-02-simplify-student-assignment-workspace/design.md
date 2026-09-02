## Context

The student workspace presents one assignment revision, question drafts,
attachments, per-question submission state, resubmission grants, history,
approved feedback, and released results.  It calls the Assignment public API
and must remain a role-safe projection: a student may see only their frozen
ownership and released material.

The `code-simplification` workflow applies after C16 so the client no longer
has to compensate for Data Governance orchestration leakage.

## Goals / Non-Goals

**Goals:**

- Reduce repeated async/state logic and make the student's valid next actions
  easier to follow.
- Preserve assignment/revision/question/answer/attempt identity, attachment
  integrity, idempotency, save/submit/resubmit semantics, and release privacy.
- Preserve load, empty, stale, conflict, upload, processing, blocked, error,
  history, feedback, result, and responsive accessibility states.
- Record measurable before/after simplification evidence.

**Non-Goals:**

- Changing Assignment, Assessment, Learning Record, or object-store contracts.
- Adding a client state library, second submission state machine, or raw-event
  fallback.
- Exposing reference answers, teacher diagnostics, other students, or unreleased
  feedback.
- Completing the change with file splitting or visual restyling only.

## Decisions

### 1. Freeze student behavior before editing

Capture callers, DTOs, fetch/mutation ordering, local draft preservation,
attachment preflight/sign/finalize/read, question states, retry/conflict paths,
submission/resubmission, history, approved feedback/result visibility, and
keyboard/focus behavior.  Record representative ordinary, empty, stale,
processing, failed-upload, and released-result cases.

### 2. Simplify repeated client transitions

Use named predicates and guard clauses for assignment/question/asset state,
deduplicate identical request status/error mapping, and centralize only truly
identical refresh/preserve-local-draft behavior.  Keep draft, processing,
submitted, returned, resubmission, released, and unavailable states distinct;
do not compress them into a generic boolean.

### 3. Preserve server authority and evidence separation

All commands continue through Assignment's public API with authenticated
student scope.  The client never decides revision ownership, attempt identity,
release eligibility, score, or Learning Record evidence.  Local input is draft
state only; durable submissions/attachments and Assessment/Learning Record
effects remain server-owned.

### 4. Preserve safe result projection

Approved feedback and result packages remain visible only under the existing
frozen student/release checks.  Simplification cannot widen result or asset
scope, expose teacher/AI fields, or infer a result from a local draft.

### 5. Measure comprehension improvement

Record before/after lines, functions/components, branches/state transitions,
duplicate request paths, imports, and behavior/accessibility outcomes.  A
refactor that only relocates code is rejected.

## Risks / Trade-offs

- [Upload and submit states are accidentally merged] → test object integrity,
  per-question state, idempotent retry, and attempt identity independently.
- [Local draft is lost on reload/conflict] → preserve the existing safe merge
  and reload behavior with stale-version tests.
- [Released feedback leaks to another student] → keep frozen ownership and
  result-package authorization assertions.
- [Compact rendering hides blocked/processing explanations] → run state and
  keyboard/focus coverage for every terminal and recoverable state.

## Migration Plan

1. Freeze student workspace behavior and complexity baseline after C16.
2. Apply one concrete code-simplification transformation at a time and run
  direct tests.
3. Compare command payloads, state transitions, asset behavior, result privacy,
  and accessibility against the baseline.
4. Record after metrics and accepted/rejected/deferred transformations.
5. Revert any transformation that alters domain semantics or reduces recovery;
  no data migration is involved.

## Open Questions

None.  The smallest clear transformation supported by behavior evidence is the
implementation choice; no line-count target is prescribed.
