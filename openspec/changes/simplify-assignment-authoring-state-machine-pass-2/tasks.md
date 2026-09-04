## 1. Baseline

- [ ] 1.1 Confirm the 103,947-byte workspace baseline and record its state owners, effects, request paths, imports, and public exports.
- [ ] 1.2 Characterize load, edit, save, stale conflict, AI draft, validation, publication, focus, CAS, and idempotency behavior.

## 2. Simplify

- [ ] 2.1 Replace behavior-equivalent save/publication state and response branches with the smallest explicit local representation.
- [ ] 2.2 Remove redundant derived booleans, effects, and single-caller helpers while keeping distinct mutation semantics explicit.
- [ ] 2.3 Remove imports and tests made obsolete by the accepted simplifications.

## 3. Verify

- [ ] 3.1 Run focused editor, conflict, AI-draft, validation, publication, and accessibility tests plus typecheck and lint.
- [ ] 3.2 Record the fixed before/after calculation proving an after total of at most 93,552 bytes, including extracted production code.
- [ ] 3.3 Run strict OpenSpec validation and review the final diff for API, lifecycle, or scope changes.
