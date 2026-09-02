## Context

现有 `practice-lab-artifact-run-contract` 已定义 `ArtifactRunIdentity`、canonical identity hash、source owner/authority、Practice/preview/official visibility、model relation、executor/authority source、hidden-input privacy 和 replay identity。实际消费者仍分散在 Workbench 的 `contracts/artifact-bridge.ts`、Arena `workbench/artifact-mappers.ts` 与 submission builders、SimulationRun `core/run-contract.ts`、Manifest Runtime 适配器以及虚拟 preview route。

本变更只收口消费者。合同本身、`control-engine-wasm-facade`、Arena evaluator 和现有数据库记录均是上游约束；C23/C24 只有在本 change 的迁移证据完成后才可删除其过渡入口。

## Goals / Non-Goals

**Goals:**

- 证明每类消费者都通过既有 v1 contract 得到同一 canonical identity 和安全 public projection。
- 迁移完成后删除仅用于重复转换的内部桥接，不留下双写、双读或双状态。
- 保留 artifact/run source owner、Arena evaluator authority、preview/Practice 非正式性和 server-facade persistence。
- 输出可供 C23/C24 使用的 zero-caller、replacement、rollback 和 contract-parity 证据。

**Non-Goals:**

- 不新增或重建 Artifact/Run contract、Prisma schema、数据库迁移、WASM facade、Rust 数值逻辑或官方评分协议。
- 不改变 controller artifact 字段含义、task/spec identity、replay checksum、hard constraints、leaderboard 或历史结果。
- 不把 browser/worker preview 变成持久化 authority，也不让 Manifest Runtime 绕过现有 submission/evidence gates。

## Decisions

### 1. Keep the existing contract as the only seam

消费者通过 `src/lib/practice-lab-run-contract` 的 canonicalize/project/validate API 获取 envelope。局部模块可保留面向 UI 的 view model，但不得重新声明 source/authority/visibility/checksum 语义或保存第二份 identity。

### 2. Migrate by consumer class

先迁移 Workbench artifact draft 与 preview projection，再迁移 Manifest Runtime/Practice live，最后迁移 Arena preview adapters。每一类都先对照现有 characterization 的 identity 字段、错误语义、privacy 和 non-official 标志，再删局部 mapper。Arena official submission/evaluation 只引用合同投影，不由合同接管 evaluator authority。

### 3. Preserve server authority and fixed-step numerics

合同迁移只处理 envelope 和数据转换。浏览器/worker 仍只能返回 display-only preview；`/api/arena/virtual-simulation-runs` 仍由 server facade 重算、摘要、checksum 和持久化。页面继续由 `SimulationClock` 以固定步长调度，所有数值仍来自 Rust/WASM facade。

### 4. Publish dependency readiness for C23/C24

完成后提供一份 revision-bound caller matrix：每个旧 mapper 的 production/test/operator caller、替代 contract API、删除条件和 rollback commit。C23/C24 不得在该矩阵缺项时删除 bridge 或 Arena legacy entrypoint。

## Risks / Trade-offs

- [Risk] 局部 mapper 隐含字段转换或兼容版本。→ 逐类保留 characterization，比较完整 canonical identity 和 public projection，未知字段先阻止删除。
- [Risk] preview 与 official 投影被误合并。→ 对 `evaluationVisibility`、`officialEligible`、`executor`、`authoritySource` 和 official promotion 运行负向测试。
- [Risk] 删除 mapper 误触 Arena server authority。→ 只删除纯转换层；保留 evaluator、submission persistence、hidden-input 和 server facade 模块。

## Migration Plan

1. 冻结既有 contract 版本、owner/authority、privacy、checksum/tolerance 和所有消费者清单。
2. 为每类消费者建立 before projection 与行为 characterization；标记局部字段仅展示还是进入持久化。
3. 迁移 Workbench、Manifest/Practice、Arena preview 到 canonical API，保持 existing error/status semantics。
4. 删除无 caller 的重复 mapper/类型/验证，并记录 C23/C24 的依赖-ready receipt。
5. 运行 contract、preview/Practice、replay、official-boundary、role/privacy、固定步长和 server-facade tests，再做 typecheck 与严格 OpenSpec 校验。

Rollback 恢复最后一个完整迁移提交和其 contract projection；不得恢复第二套 Artifact/Run authority 或以客户端结果填充历史运行。

## Open Questions

无。若某消费者无法证明其 owner、authority 或 replacement，保持迁移未完成并阻塞 C23/C24。
