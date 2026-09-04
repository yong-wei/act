## Why

The first student workspace simplification removed repeated helpers but increased the file to 75,547 bytes and deferred the busy-action lifecycle, response-status branches, and preview state/ref duplication. These remaining representations make upload, draft, submit, resubmit, and result behavior costly to reason about.

## What Changes

- Characterize current draft, upload, preview, submit, resubmit, history, feedback, and result transitions before editing them.
- Collapse only equivalent busy/action and response-status representations, and remove duplicate preview bookkeeping where tests prove the same lifetime and cleanup behavior.
- Delete redundant guards, derived state, effects, and single-caller helpers without adding a generic action executor.
- Reduce the 75,547-byte workspace implementation to at most 67,992 bytes, counting any production code extracted from it; file splitting alone does not qualify.
- Preserve request order, attachment integrity and order, conflict recovery, focus behavior, attempt identity, idempotency, feedback privacy, and released-result semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `student-assignment-workspace-simplification`: add a second-pass requirement for measurable client state-machine reduction with unchanged Assignment lifecycle behavior.

## Impact

- Primary code: `src/features/assignments/student-assignment-workspace.tsx` and its focused tests; adjacent contracts only when a verified duplicate is removed.
- Verification: student workspace, attachment, attempt/resubmission, privacy/result, accessibility, typecheck, lint, and before/after metrics.
- No Assignment API, database schema, route, public component API, result-release policy, or visual redesign.
