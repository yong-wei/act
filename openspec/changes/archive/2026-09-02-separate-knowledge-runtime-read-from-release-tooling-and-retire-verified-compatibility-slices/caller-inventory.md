# C21 caller inventory

绑定修订：`55b029a26e`（C23 squash / 本 change 起点）

G 系列：五项已归档；`adopt-active-authority-knowledge-workspace` 本地仍为活动 change。GitHub native `blockedBy` 仅已关闭 #1743/#1774。本变更不改 selector / shard / schema / production Authority。

## 产品 graph → release writer（迁移前）

| 生产文件 | 导入 | 用途 | replacement |
|---|---|---|---|
| `src/lib/authoritative-knowledge/repository.ts` | `scripts/actkg-release/authoritative-release` `canonicalJson`,`sha256` | 绑定 digest / artifact hash | `src/lib/authoritative-knowledge/canonical-json.ts` |
| `src/lib/actkg-v022-display-projections/envelope.ts` | 同上 | mirror receipt 与 sealed file hash | 同上 |
| `src/lib/teaching-projection/textbook-locators/inventory.ts` | `scripts/actkg-release/actkg-canonical-digests` `computeCanonicalReleaseHash` | Authority release self-hash | 同上 |
| `src/app/**`、`src/features/**` | 无（测试除外） | — | 保持 |

`src/app` / `src/features` 生产文件在迁移前已不导入 `scripts/actkg-release` 或 `scripts/knowledge-cutover`。

## Compatibility slices

| slice | owner | 生产 caller | operator caller | 测试 | 删除条件 | 结论 |
|---|---|---|---|---|---|---|
| `bundle-compatibility-registry.ts` (v1) | actkg-release | 无 | `public-bundle-v1.ts`、`latest-stable-aggregate.ts`、`public-bundle-aggregate-integrity.ts`、`prepare-latest-actkg-chain-intake.ts` | 多项 `src/lib/__tests__/actkg-*` | operator 归零且 replacement 证明 | **retained** |
| `bundle-compatibility-registry-v2.ts` | actkg-release | 无 | `public-bundle-v2.ts`、admission、capture-revision、cutover v0.18 | 多项 v2 兼容测试 | 同上 | **retained** |
| `bundle-compatibility-registry-v022.ts` | actkg-release | 无 | `prepare-actkg-v022-*`、`actkg-v022-release-mirror.ts` | v022 candidate 测试 | 同上 | **retained** |
| CTKG 0.1 `HISTORICAL_RELEASE_SET_LOCK_PATH` | authoritative-release | 历史 overlay 读 | 历史 import 命令 | repository/release 测试 | 历史审计仍需要 | **retained** |

无 slice 同时满足「生产+operator 零 caller」且有 replacement/rollback 证明，故本变更不删除 compatibility 实现。

## Rollback

恢复本 change 中 `canonical-json.ts` 与三处生产 import 的提交。不改 selector，不删除 retained slices。
