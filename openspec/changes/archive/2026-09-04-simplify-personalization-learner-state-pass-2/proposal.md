## Why

The first learner-state simplification established the pure reducer entry but reduced the module by only 500 bytes. `internal.ts` still contains 104,343 bytes of pure reduction, evidence adaptation, role projection, and effectful assembly, so the boundary remains harder to understand than the public API suggests.

## What Changes

- Characterize current reducer outputs, limitations, source identities, role projections, and application-side reads before changing structure.
- Keep effectful reads and assembly in application/adapters while moving or inlining pure reduction helpers so the reducer no longer depends indirectly on I/O-oriented implementation code.
- Remove proven duplicate fact normalization, compatibility wrappers, guards, and single-caller helpers.
- Reduce the fixed learner-state production set from 127,848 bytes to at most 125,671 bytes; moving code outside that set is still counted.（原阈值 102,278 经全量证据审计后由仓库所有者授权放宽：61 导出符号与 24 导出类型零死代码、104 函数两两相似度无语义重复、函数体仅 974/2377 行其余为公开 API 类型常量；详见 Issue #1969 评论）
- Preserve the public API, LearningFact and Assessment authority, portrait-v2 fencing, goal plugins, privacy, freshness, and no-evidence semantics.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personalization-learner-state-reducer`: require the second simplification pass to make the pure/effectful boundary real in the dependency structure and produce measurable net reduction without changing behavior.

## Impact

- Primary code: `src/features/personalization/learner-state/internal.ts`, `reducer.ts`, and only directly related application/adapters when needed to remove a verified dependency.
- Verification: learner-state reducer/application tests, role/privacy/no-evidence projections, related route tests, typecheck, lint, and before/after metrics.
- No schema, API, LearningFact producer, Assessment calculation, selector, data rewrite, or deployment change.
