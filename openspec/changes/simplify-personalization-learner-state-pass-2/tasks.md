## 1. Baseline

- [ ] 1.1 Confirm the seven-file 127,848-byte baseline and record imports, public exports, and current reducer/application responsibility owners.
- [ ] 1.2 Add or confirm characterization for reducer output, source identity, role/privacy projection, stale/missing evidence, unsupported goals, and application reads.

## 2. Simplify

- [ ] 2.1 Separate effectful application/adapters from the pure reducer dependency graph without adding a forwarding layer.
- [ ] 2.2 Remove duplicate fact conversion, projection, compatibility, guard, and single-caller helper logic in bounded passing steps.
- [ ] 2.3 Remove imports and tests made obsolete by the accepted simplifications.

## 3. Verify

- [ ] 3.1 Run focused reducer/application, role/privacy/no-evidence, and related route tests plus typecheck and lint.
- [ ] 3.2 Record the fixed before/after byte calculation proving an after total of at most 102,278 bytes with unchanged public exports.
- [ ] 3.3 Run strict OpenSpec validation and review the final diff for behavior or scope changes.
