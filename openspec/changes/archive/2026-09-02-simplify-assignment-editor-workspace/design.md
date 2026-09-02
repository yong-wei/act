## Context

The assignment editor renders teacher draft loading, question and rubric
editing, governed question selection, content assets, validation, save state,
revision conflicts, publication settings, and AI-assisted authoring.  The
Assignment API is the authority for persistence and publication; the editor is
a client projection and command adapter.

The `code-simplification` skill requires a behavior baseline, caller/history
understanding, incremental transformations, and tests that pass without
weakening assertions.

## Goals / Non-Goals

**Goals:**

- Reduce real control-flow/state duplication and improve editor readability.
- Preserve draft/published boundaries, revision/CAS/idempotency behavior,
  validation, content snapshots, audience rules, and teacher approval.
- Preserve accessible loading, empty, conflict, error, and recovery states.
- Produce a before/after simplification ledger.

**Non-Goals:**

- Changing Assignment API contracts, routes, persistence, schema, or scoring.
- Adding a form framework, state library, generic editor abstraction, or second
  draft/publish state machine.
- Moving authoring logic into Data Governance, Assessment, or Learning Record.
- Satisfying the change by splitting files without reducing complexity.

## Decisions

### 1. Freeze the actual editor behavior

Record callers, state transitions, async mutation ordering, save/conflict
responses, question/rubric/asset payloads, publication blockers, AI draft
approval steps, keyboard order, and responsive states before editing.  Use
history for non-obvious guards and preserve existing public labels/markers.

### 2. Simplify state transitions, not domain rules

Use named transition predicates and explicit early returns for load/save/conflict
and validation branches.  Deduplicate repeated request status/error mapping and
question/asset update paths only when their side effects and ordering are
identical.  Keep meaningful concepts named; do not collapse distinct draft,
stale, published, or approval states into a boolean.

### 3. Keep the editor a thin Assignment client

Commands continue through the Assignment public API with server-derived actor,
assignment, revision, class, and asset scope.  The editor never authorizes a
class, mutates a published snapshot, decides a final score, or treats an AI
draft as approved content.

### 4. Preserve safe UI recovery

Simplification must retain focus/error association, keyboard ordering, stale
revision recovery, local draft preservation where currently supported, and
bounded retry/cancel behavior.  Network errors or conflicts remain explicit;
the client does not silently overwrite a newer revision.

### 5. Measure before/after clarity

Record line count, component/function count, branch/duplicate inventory,
state-transition count or equivalent complexity, imports, and behavior/test
results before and after.  A file extraction, rename, or formatter-only change
is not evidence of a net simplification.

## Risks / Trade-offs

- [A simplified mutation helper merges operations with different CAS semantics]
  → compare request payloads, idempotency keys, ordering, and errors per action.
- [AI draft content bypasses teacher approval] → retain explicit draft/approved
  states and assert server API calls for approval.
- [A conflict loses local input] → preserve existing recovery behavior and test
  stale version with concurrent edits.
- [A compact render branch harms accessibility] → run keyboard, focus,
  validation, narrow-viewport, and screen-reader marker tests.

## Migration Plan

1. Freeze editor behavior and complexity baseline after C15.
2. Apply one code-simplification transformation at a time; run direct tests.
3. Compare draft, revision, rubric, asset, AI, publication, and accessibility
  behavior against the baseline.
4. Record after metrics, accepted/rejected transformations, and the final
  import/behavior diff.
5. Revert any transformation that changes domain semantics or increases
  reasoning burden; no data migration or rollback rewrite is required.

## Open Questions

None.  The implementer chooses the smallest clear transformation supported by
the baseline; no target line count is imposed.
