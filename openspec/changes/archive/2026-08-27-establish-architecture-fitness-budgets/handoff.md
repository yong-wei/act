# Handoff to #1554

## Qualified input identities

本 change 的 ledger 以以下已登记输入为分母：

- census baseline hash `40549dcad9b03da31abc6ef05c5ede5bff4e04b47268f86450831aa39788c52a`，source commit `58c77cbf6e0f6cd284e1eea6a39ca4df8854ebac`，source tree `189dfeb5ad35f1d88e8ea5509a48b388424bf88f`；
- dependency allowlist hash `0d29851dcb123f0f2bb78346c9562753b163b33239e6ef7737a8a7190f9ba608`；
- modular-monolith charter hash `76850de671d65e821dd2acebe070ab23d6a3f26a3a7d9f9527e32af75c957396`；
- fitness ledger hash `bd2da413d2c5f75e8a387e7efb4f334a4c76f637e98192b04775fcdac49a09ed`，ledger source 与 census baseline 相同，包含 1204 条 budget record。

Ledger record 的 schema 是 `act-architecture-fitness-budget/v1`；报告 schema 是 `act-architecture-fitness-report/v1`。结构预算复用 census/allowlist/charter，编译预算只接受四张 graph 的 source-bound manifest 和 immutable measurement receipt。

## Current disposition

Ledger 绑定的是 census baseline，不是当前 HEAD。`fitness:architecture` 在本 change 合入后仍应诚实失败，不能作为 qualified release evidence。

当前报告会保留历史结构 debt，并对实现 revision 报告：

- 现有 teacher diagnosis 的 feature→App Router 边仍未被当前 allowlist 登记，报告为 forbidden dependency failure；
- baseline 冻结的 oversized/center observation 发生增长或出现新增 observation 时失败；
- 当前 source identity 下没有四张 clean、passing、manifest-hash-matched graph receipt，compile-resource records 为 blocked；
- 历史 Web production→tooling 边只能作为 blocker receipt，不能被解释为 tsc error，也不能用 heap 参数掩盖。

这组状态不表示全仓已重构。要形成 #1554 可消费的 qualified 输入，必须在 clean implementation checkpoint 上重新运行四张 graph，取得同一 source commit/tree 的 manifest 与 receipt，并保留 tools/test 作为 PR/integration mandatory inputs。`fitness:architecture` 不进入 `verify:commit`。

## #1554 消费合同

1. 读取 `fitness-budget-ledger.json`、allowlist、charter 和报告的 exact identity；不要复制 dependency discovery、owner catalog 或 TS graph。
2. 只接受当前 source-bound、`dirty=false`、`status=passed`、`exitStatus=0` 且 manifest hash 相符的 Web、worker、tools、test receipt。
3. 对 `blocked`、`unresolved`、新 forbidden dependency、冻结指标增长、exception addition/pattern widening/field drift/owner transfer fail closed；不要把 legacy debt 或 `trend`/`observed` 写成 clean。
4. `typecheck:tools` 与 `typecheck:test` 是 PR/integration 的 mandatory inputs；nightly 不能替代。production-to-tooling 历史边仍由 receipt blocker 语义单独处理。

## 重放命令

```sh
rtk node --import tsx ./scripts/architecture-fitness.ts
rtk npm run typecheck:web
rtk npm run typecheck:worker
rtk npm run typecheck:tools
rtk npm run typecheck:test
rtk openspec validate establish-architecture-fitness-budgets --type change --strict
rtk git diff --check
```

标准 `rtk npm run fitness:architecture` 使用 `node --import tsx` 启动，不依赖 tsx CLI IPC；若其他项目命令仍受执行环境限制，应将该环境限制记录为独立 blocker。
