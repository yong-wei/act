# Tasks: issue-2080-read-mixed-identity-feature-cache

## 1. 读取侧修复

- [x] 1.1 扩展 `src/lib/data-governance/student-evidence-feature-cache.ts` 的 `hasStatusMarkersSchema` 允许集合，加入 `mixed-knowledge-identity`（约 :2423-2433）；未知标记值保持拒绝。
- [x] 1.2 同步扩展画像中心 `profile-center.ts` 的 `normalizeStatusMarkers`（约 :455-466），透传 `mixed-knowledge-identity` 标记。

## 2. 回归测试

- [x] 2.1 在 `__tests__/student-evidence-feature-cache.test.ts` 补 round-trip 用例：单版本（写入后读取 `ready`）。
- [x] 2.2 混合版本（LEGACY_UNVERSIONED + CANONICAL 合格事实，写入后读取 `ready` 且标记与 `singleVersionComparable=false` 标注保留）。
- [x] 2.3 未知标记值（读取判 `stale`，fail-closed）。
- [x] 2.4 真实过期与结构损坏（维持既有 `stale` 路径）。
- [x] 2.5 画像中心用例：混合身份缓存进入画像后标记保留、置信状态不为 `stale`。

## 3. 验证与运维

- [x] 3.1 `rtk npm run test:unit`（相关测试文件）与 `rtk npm run typecheck` 通过。
- [x] 3.2 用既有重建路径（`refreshStudentEvidenceFeatureCache` / 数据治理 worker）重建受影响学生缓存，核验 `state=ready` 且 `sourceCounts.LearningFact` 与实际合格证据数一致。
- [x] 3.3 `openspec validate issue-2080-read-mixed-identity-feature-cache --type change --strict` 通过。
