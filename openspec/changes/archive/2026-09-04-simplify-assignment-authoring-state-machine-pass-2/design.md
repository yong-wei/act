## Context

`assignment-editor-workspace.tsx` is 103,947 bytes. Its first simplification removed repeated local helpers but left load/save/conflict/generation/publication lifecycle handling distributed across booleans, effects, and response branches.

## Goals / Non-Goals

**Goals:**

- Reduce repeated client state and request-result branches.
- Reduce the 103,947-byte workspace implementation to at most 93,552 bytes while preserving the existing Assignment API lifecycle.

**Non-Goals:**

- No generic workspace framework, UI redesign, route change, API/schema change, or merge of authoring and student workspaces.
- No change to CAS, idempotency, immutable revisions, validation, or teacher approval.

## Decisions

1. Characterize the actual transitions and request order for load, edit, save, stale conflict, AI draft, validation, and publish before refactoring.
2. Derive display and action availability from the smallest existing authoritative state. A local tagged state or pure transition helper is acceptable only when it replaces multiple booleans or effects rather than wrapping them.
3. Merge response mapping only where endpoint, payload, CAS/idempotency behavior, recovery, and focus order are equal. Distinct mutation semantics remain separate.
4. The baseline is `assignment-editor-workspace.tsx` at commit `f79f1836fd57dce483d01194e627ef36d929d637`, totaling 103,947 bytes. The after total is that file plus new production files and positive byte deltas in existing production files that receive code extracted from it.

## Risks / Trade-offs

- [Save and publish races become conflated] → keep request identities and CAS handling separate unless tests prove exact equivalence.
- [Local input is lost on recovery] → characterize stale/error retries and focus restoration before changing state ownership.
- [A helper layer hides rather than removes complexity] → count extracted code in the after total and reject any result above 93,552 bytes.
