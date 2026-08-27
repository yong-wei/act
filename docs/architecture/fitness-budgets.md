# Architecture fitness budgets

本目录的 fitness budget 只投影已存在的 architecture census、modular-domain dependency allowlist、charter 和 TypeScript graph receipt，不创建第二套 discovery、owner catalog 或依赖图。

## 固定身份

| 输入 | identity |
| --- | --- |
| census baseline | `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a` |
| census source | `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac` / `189dfeb5ad35f1d88e8ea5509a48b388424bf88f` |
| dependency allowlist | `0d29851dcb123f0f2bb78346c9562753b163b33239e6ef7737a8a7190f9ba608` |
| charter | `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396` |
| budget ledger | `bd2da413d2c5f75e8a387e7efb4f334a4c76f637e98192b04775fcdac49a09ed`，见 [`fitness-budget-ledger.json`](./fitness-budget-ledger.json) 与 [`fitness-budget-ledger.sha256`](./fitness-budget-ledger.sha256) |

Ledger record 使用固定 schema `act-architecture-fitness-budget/v1`，字段为 `budgetId`、`metricKind`、`scope`、`baselineIdentity`、`sourceCommit`、`sourceTree`、`observedValue`、`direction`、`owner`、`evidenceRefs`、`exceptionState`、`deletionCondition`、`followUpChange`、`status` 和 `totals`。`totals` 始终包含 `included`、`excluded`、`unresolved`。

## 门禁语义

- `dependency-edge`、`reverse-edge`、`deep-import`、`feature-to-app`、`scc` 复用既有 census 与 allowlist。新增 forbidden edge、deep import、feature→App Router edge 或 SCC member 无条件失败；forward/reverse/SCC 分母不闭合时 fail closed。
- `src-lib-freeze`、`file-size` 和 `center-node` 绑定 baseline source identity、owner、caller/dependency evidence、change reason 和 deletion/split condition。冻结的文件尺寸或中心指标增长失败，不能通过增加 exception、扩大 pattern、补字段、改名或转移 owner 绕过。
- exception 集合只能删除或由合规替换删除。新条目、重复条目、pattern 扩大、字段漂移、删除条件移除和 owner transfer 都是未达资格的变更。
- `compile-resource` 只消费 `scripts/typescript-graphs/` 产生的 revision-、command-、manifest-bound receipt。`peakRssBytes`、duration、platform、toolchain 和 cache 是 receipt 观察值，不是跨环境永久阈值；`trend` 与 `observed` 不伪装成 deterministic success，缺失、脏、过期、失败或 boundary blocker 为 `blocked`。

标准 CLI 将 `.logs/typescript-graphs/` 视为当前 revision receipt，并从可选的 `docs/architecture/typescript-graphs/frozen-receipts/` 读取 frozen compile baseline。该目录是输入通道，目录不存在或为空时 compile-resource 保持 blocked，不得生成占位 receipt，也不得把缺失的冻结 receipt 解释为 trend/qualified。

报告 schema 为 `act-architecture-fitness-report/v1`。报告按 `budgetId` 和 failure identity 稳定排序，并在序列化前检查本机绝对路径、凭据和 learner payload。历史 debt 仍显示 owner、consumer evidence、reason、deletion condition 和 follow-up change；allowlist 不代表全仓已完成迁移。

Fitness report 只负责这些输入的结构性投影，不替代 domain dependency contract、`src/lib/architecture-test-commands`、release qualification 或既有 frontend/source-boundary gates。

## 验证

```sh
rtk node --import tsx ./scripts/architecture-fitness.ts --write-ledger
rtk node --import tsx ./scripts/architecture-fitness.ts
rtk npm run typecheck:web
rtk npm run typecheck:worker
rtk npm run typecheck:tools
rtk npm run typecheck:test
rtk openspec validate establish-architecture-fitness-budgets --type change --strict
```

`npm run fitness:architecture` 是标准入口，脚本使用 `node --import tsx` 避免 CLI IPC 依赖；不得以 heap 参数替代 graph 或 receipt 证据。
