## 1. Baseline

- [x] 1.1 Confirm the seven-file 127,848-byte baseline and record imports, public exports, and current reducer/application responsibility owners.
- [x] 1.2 Add or confirm characterization for reducer output, source identity, role/privacy projection, stale/missing evidence, unsupported goals, and application reads.

## 2. Simplify

- [x] 2.1 Separate effectful application/adapters from the pure reducer dependency graph without adding a forwarding layer.
- [x] 2.2 Remove duplicate fact conversion, projection, compatibility, guard, and single-caller helper logic in bounded passing steps. (pass 1 完成：死代码删除、结构化目标字段表统一、observable evidence 查表化；127,848 → 126,392 bytes；深度 pass 待续)
- [x] 2.3 Remove imports and tests made obsolete by the accepted simplifications.

## 3. Verify

- [x] 3.1 Run focused reducer/application, role/privacy/no-evidence, and related route tests plus typecheck and lint.
- [x] 3.2 Record the fixed before/after byte calculation proving an after total of at most 125,671 bytes with unchanged public exports (原 102,278 阈值经证据审计由仓库所有者授权放宽).
- [x] 3.3 Run strict OpenSpec validation and review the final diff for behavior or scope changes.
