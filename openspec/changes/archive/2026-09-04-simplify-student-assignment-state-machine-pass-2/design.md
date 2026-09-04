## Context

`student-assignment-workspace.tsx` is 75,547 bytes. The first pass removed repeated helpers but left busy-action ownership, response-status derivation, preview URL lifetime, upload recovery, and submission state spread across parallel state and effect paths.

## Goals / Non-Goals

**Goals:**

- Reduce duplicated busy, response, and preview state representations.
- Reduce the 75,547-byte workspace implementation to at most 67,992 bytes while preserving the student Assignment lifecycle.

**Non-Goals:**

- No generic action executor, UI redesign, route/API/schema change, or public component API change.
- No change to attachment integrity/order, submission ordering, attempt identity, idempotency, conflict recovery, or result privacy.

## Decisions

1. Characterize draft, upload, preview, submit, resubmit, history, feedback, and released-result transitions before editing.
2. Derive response status and action availability from existing authoritative request and server state. Consolidate busy keys only when cancellation, error, focus, and retry behavior match.
3. Give preview URL creation and cleanup one owner when tests prove the same lifetime across state and ref paths; cleanup remains explicit on replacement and unmount.
4. The baseline is `student-assignment-workspace.tsx` at commit `f79f1836fd57dce483d01194e627ef36d929d637`, totaling 75,547 bytes. The after total is that file plus new production files and positive byte deltas in existing production files that receive code extracted from it.

## Risks / Trade-offs

- [Upload or submit order changes] → preserve endpoint-specific tests and request sequence assertions.
- [Preview URLs leak or revoke too early] → add lifecycle tests before consolidating state/ref ownership.
- [A shared executor obscures special cases] → reject generic wrappers and any after total above 67,992 bytes.
