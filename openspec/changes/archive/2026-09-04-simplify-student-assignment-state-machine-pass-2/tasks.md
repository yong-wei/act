## 1. Baseline

- [x] 1.1 Confirm the 75,547-byte workspace baseline and record its state owners, effects, request paths, imports, and public exports.
- [x] 1.2 Characterize draft, upload, preview, submit, resubmit, history, feedback, result, focus, conflict, and idempotency behavior.

## 2. Simplify

- [x] 2.1 Consolidate only equivalent busy/action and response-status representations while preserving endpoint-specific ordering and recovery.
- [x] 2.2 Give preview URL creation and cleanup one owner where lifecycle tests prove equivalent behavior, then remove redundant state/effects/helpers.
- [x] 2.3 Remove imports and tests made obsolete by the accepted simplifications.

## 3. Verify

- [x] 3.1 Run focused workspace, attachment, attempt/resubmission, privacy/result, preview-lifecycle, and accessibility tests plus typecheck and lint.
- [x] 3.2 Record the fixed before/after calculation proving an after total of at most 67,992 bytes, including extracted production code.
- [x] 3.3 Run strict OpenSpec validation and review the final diff for API, lifecycle, or scope changes.
