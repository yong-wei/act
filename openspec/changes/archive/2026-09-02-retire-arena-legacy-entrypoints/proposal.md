## Why

Arena 目前同时暴露 `domain.ts`、`client.ts`、`server.ts` 和根 `index.ts`，历史消费者还通过 root barrel 或跨边界直达内部模块。C22 已提供统一 Artifact/Run contract，C23 将移除 simulation-arena-workbench 过渡层；C24 需要清理剩余 legacy aliases，同时保留 client-safe 与 server-only 的明确边界。

## What Changes

- 盘点并迁移所有 Arena root barrel、旧别名和不符合边界的 import；生产代码不得继续以 `@/features/arena` 作为默认入口。
- 保留现有 Arena domain/client/server 公共边界中仍有真实消费者的能力，并删除已证明 zero-caller 的兼容入口、re-export 与旧测试。
- 正式 submission/evaluation、hidden inputs、score、validity、constraints 和 leaderboard 继续只由 Arena 服务端 authority 负责；客户端只能调用 client-safe preview/展示合同。
- 记录每个删除入口的 replacement、zero-caller、rollback 和 role/privacy 证据，避免以“legacy”标签误删有效能力。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `arena-module-boundary`: 将 root barrel 从长期兼容入口收敛为待删除的临时兼容面，并明确保留必要的 domain/client/server 边界。

## Dependency and Boundary

本变更为 C24，依赖 C22 `migrate-practice-artifact-consumers-to-existing-contract` 和 C23 `retire-simulation-arena-workbench-bridge`。不得在 C22/C23 的 replacement 和 zero-caller 证据缺失时删除 Arena 入口。

不重建 Artifact/Run contract 或 WASM facade，不改变 Arena official protocol、server evaluator、production selector、数据库模型、preview 语义或 Rust 数值真源。

## Impact

- Entry points：`src/features/arena/index.ts`、`domain.ts`、`client.ts`、`server.ts` 及其直接/间接 callers。
- Consumers：Arena routes、challenge detail、workbench submission/preview、teacher publication、tests、dynamic imports 和 compatibility scripts。
- 保留 `arena-module-boundary` 的 client-safe/server-only 规则、服务端评测 authority、fixed-step facade 和 preview≠official。
