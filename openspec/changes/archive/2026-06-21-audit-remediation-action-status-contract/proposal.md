## Why

The audit repeatedly found that actions complete, fail, or are ignored without visible state, download events, or accessible announcements. A cross-role status contract is needed before fixing each workflow page, otherwise every remediation will invent inconsistent local messages.

## What Changes

- Define a shared action-state model for submit, save, filter, export, download, send, approve, writeback, model test, and governance resolve/assign.
- Require visible status, failure recovery, and `role=status` or `aria-live` behavior for audited asynchronous actions.
- Add reusable UI/service contracts so pages cannot silently swallow URL actions or API method errors.
- Require audit-report remediation markers when a status gap is closed.

## Capabilities

### New Capabilities
- `audit-remediation-action-status-contract`: shared Product Design audit remediation contract for action states and accessible status feedback.

### Modified Capabilities
- None. This proposal establishes a remediation-level contract consumed by student, teacher, admin, AI, and mobile fixes.

## Impact

- Affects shared status UI, forms, downloads, report actions, configuration tests, governance actions, and route-driven action handlers.
- Evidence references include `chapters/49-function-state-flows-batch41.md`, `chapters/50-function-state-flows-batch42.md`, `chapters/51-function-state-flows-batch43.md`, `chapters/54-function-state-flows-batch46.md`, and `chapters/63` through `67`, where batches repeatedly report `alerts=0`.
