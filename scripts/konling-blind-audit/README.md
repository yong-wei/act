# 知识问答盲审评测（Issue #1820）

可断点续跑、逐条原子持久化并按完整性门禁汇总的知识问答盲审评测。
长批次外部模型失败（限流、超时、余额不足、单条解析失败）被视为正常
运行条件：每条审计完成即落盘，中断后用相同 runId 续跑，已完成条目
不会重复计费。

## 结构

- `src/lib/konling-blind-audit/types.ts`：模式、任务键、记录与汇总契约。
- `src/lib/konling-blind-audit/benchmark.ts`：`blind-audit-v1` 版本化清单与内容哈希。
- `src/lib/konling-blind-audit/store.ts`：run 目录（独占锁 + stale 接管）、原子写入、只增不改布局。
- `src/lib/konling-blind-audit/runner.ts`：续跑循环（跳过已完成、失败项每轮至多重试一次、attempt 历史保留）。
- `src/lib/konling-blind-audit/aggregate.ts`：完整性门禁（incomplete / mixed-configuration / manifest 漂移均 fail closed）。
- `scripts/konling-blind-audit/run-fixture.ts`：确定性 fixture 入口（无网络，支持故障注入）。
- `scripts/konling-blind-audit/run-live.ts`：真实模型入口（显式 opt-in）。

## fixture 演示断点续跑

```bash
# 首次运行：注入一条余额不足失败，批次标记 incomplete（退出码 1）
npm run konling:blind-audit:fixture -- --run-id demo \
  --inject blind-audit-v1--blind-audit--code-antiwindup--1=insufficient-balance

# 续跑：跳过已完成项（不重复计费），重试失败项，批次转 complete
npm run konling:blind-audit:fixture -- --run-id demo
```

产物在 `artifacts/konling-blind-audit/<runId>/`：

- `manifest.snapshot.json`：清单哈希快照（续跑漂移即失败）。
- `records/<mode>/<taskKey>.json`：completed 记录（冻结，永不覆盖）。
- `failures/<mode>/<taskKey>.json`：失败记录（attempts 数组保留全部历史）。
- `summary/<mode>.summary.json`：完整性门禁汇总；`status` 非 `complete` 时不产出正式指标。

## live 评测（手动/计划）

```bash
KONLING_BLIND_AUDIT_LIVE=1 npm run konling:blind-audit:live -- --run-id blind-240-round1
```

中断（服务失败、进程退出）后用相同 runId 重跑即从断点继续。**不要**
把 live 盲审加入普通提交门禁——外部服务波动会变成不稳定门禁。

## 与 #1819 的关联

`blind-audit-v1` 清单的六条目目对应 `konling-study-question-structure-contract`
的六类 study-question 意图，用于持续评测回答单元引用覆盖与讲解质量。
