## Context

Arena black-box preview 当前在 `controller-preview.ts` 中构造 trace：按固定循环计算 wave、controller、roll 和 metrics，随后写入 Arena preview detail，并由 store 创建 `runKind=arena_preview` 的 canonical `SimulationRun/Trace`。该循环是实际数值执行，不是 UI formatting。Arena workbench 的 `workbench-preview.ts` 则调用 white-box evaluator 的 `template-preview` provider；白箱 transfer-function adapter 明确不支持 black-box virtual preview，因而必须通过 capability matrix 区分“可在 client façade 预览”的方法和“当前不可用”的方法。

### Owner and denominator

| surface | owner | denominator |
| --- | --- | --- |
| black-box preview compute | Arena Preview | `controller-preview.ts` 的 Euler/wave/control/metric path（真实数值 1 条 loop）及 `cruise-roll-blackbox-adapter.ts` caller |
| white-box preview compute | Arena Preview + Control Engine capability | `workbench-preview.ts`、white-box provider/adapter 中实际计算函数；不包含只做 comparison/label 的代码 |
| preview API/persistence | Arena | `/api/arena/virtual-simulation-runs`、`ArenaVirtualSimulationRun`、canonical `SimulationRun`/`SimulationTrace`、replay/evidence/profile readers |
| official boundary | Arena Evaluation authority | `/api/arena/evaluate`、`/api/arena/submissions`、`ArenaEvaluationRun`/`ArenaSubmission`；本 change 只能证明不写入 |
| runtime/generated/tests | Platform/Control Engine | R1 façade, `scripts/wasm/build-control-engine.mjs`, generated package, preview/route/replay/adapter tests |

`ArenaBlackBoxExperiment`、`ArenaIdentificationModel` 和 `ArenaControllerArtifact` 仅提供已注册、已归属的 identity/reference。hidden plant/model/scenario 的 private fields 不进入 client preview request 或 response。

## Goals / Non-Goals

**Goals:**

- 让真实 preview numerics 由 Rust/WASM 经 client façade 执行，并对 supported capability 给出明确 identity。
- 保留 preview 的 trace、summary、replay 和 dataset/controller/model/sourceExperiment lineage。
- 让 unsupported Rust method、WASM not-ready、non-finite output 统一为 unavailable/invalid，不产生 heuristic numeric result。
- 证明 preview 永远不创建 official submission/evaluation/leaderboard/competency attainment。

**Non-Goals:**

- 不把 preview 变成官方评测，不新增 hidden scenario，不修改 Arena 评分或产品规则。
- 不迁移 standalone Practice numerics（R5）、server consumers（R3）或退役 raw loaders（R6）。
- 不为了支持所有白箱 method 而临时在 TypeScript 重写 Rust 数学；未有 capability 的 method 保持不可用。
- 不改变 preview storage model 或引入第二个 run schema。

## Decisions

### 1. Preview capability matrix precedes numeric migration

为每个 preview method 建立 `supportedByControlEngine`、`modelId`、request schema、result schema、protocol/runtime/model identity 和 tolerance profile。black-box controller preview 只有在 Rust model capability 注册且 generated package ready 时可运行；白箱 `template-preview`/direct analytical path 逐项登记。没有 Rust implementation 的 method 返回 `unsupported`/`unavailable`，UI 可展示受控状态，但不得执行旧 Euler/heuristic 作为替代。

### 2. Rust owns the loop; client facade owns scheduling

将现有 loop 的状态、wave/control limit、plant step 和 numerical metric denominator 分成 Rust model request/response；client 只保留 `SimulationClock` fixed-step scheduling、state rendering、trace assembly and telemetry. 不使用 `setInterval`、variable delta 或 page-local integrator。已有 preview 的 sample cadence、scenario id 和 summary keys 通过 protocol fixture 固定。

### 3. Identity and preview boundary survive the migration

每个 preview request/result 绑定 R2 envelope：owner、taskId/specHash、artifact/controller hash、datasetHash、registered model/sourceExperiment、protocol/runtime/model revision、`executor`、`authoritySource`、`modelRelation`、教学语义、`prohibitsMixedClaims`、seed、checksum 和 tolerance profile。browser/worker facade 只返回 `persisted=false` 的 display response；`/api/arena/virtual-simulation-runs` 的 response 和 canonical `SimulationRun` 必须由 R1 server facade 校验、Rust 重算、派生 trace/summary、计算 checksum 并写入，且保持 `executor=server`、`authoritySource=control-engine-server-facade`、`evaluationVisibility=preview`、`officialEligible=false`。preview 只可生成 `ArenaVirtualSimulationRun`/SimulationRun/Trace/evidence draft，不可触发 `ArenaSubmission` 或 `ArenaEvaluationRun`。

### 4. Hidden data remains outside the browser

black-box preview 使用 student-owned persisted dataset 与 registered identification model 的 coarse identity；hidden official plant/scenario/reference trajectory 永不下发。client payload 中出现 hidden field、private model coefficient、official target claim、client `trace`/`summary`/`checksum` 或 preview score mutation 时，route 在调用 server facade 前拒绝并不回显。固定 surrogate 必须记录 `modelRelation=surrogate`、受治理的教学语义和 `prohibitsMixedClaims=true`；若标记 identified，server 必须解析授权模型参数且 Rust capability 实际消费该参数。

### 5. Validate floating point by invariants and tolerances

Rust vs captured TS baseline 只比较固定 seed 的 summary metrics、finite/monotonic trace invariants、constraint counts、sample cadence 和 checksum policy；每个 capability 公布 abs/rel tolerance。高频数组不做完整精确 snapshot。若 Rust 输出超出 tolerance，preview 标记 unavailable/invalid 并阻止 persistence，不能扩大 tolerance 来掩盖模型差异。

## Hard / Contract / Soft / Delete boundaries

| class | protected fact | rule |
| --- | --- | --- |
| hard | preview/official boundary、owner/dataset/model lineage、executor/authoritySource、WASM readiness、hidden privacy、finite/fixed-step numerics、truthful modelRelation | fail closed；不得写 official rows 或隐含成功 |
| contract | capability support, modelId, request/result schema, protocol/runtime/model, executor/authoritySource, model relation/teaching semantics, seed/checksum, tolerance | facade/adapter tests and R2 envelope validator |
| soft | preview charts, loading/error text, metric formatting, optional trace density | 可调整但不改变 hard metadata |
| delete | `controller-preview.ts` Euler loop、white-box fallback numerical helpers、duplicate preview calculator | only after Rust capability parity, zero caller and browser/server evidence; R6 owns final raw-loader deletion |

## Vertical slice and no-facade proof

首条 vertical slice 是 black-box cruise-roll preview：student-owned artifact/model/dataset → client façade Rust step → non-persistent display response；持久化请求再经过 `/api/arena/virtual-simulation-runs` server façade 校验 → Rust 重算 → trace/summary/checksum → `ArenaVirtualSimulationRun` + canonical `SimulationRun/Trace` preview envelope。随后按 capability matrix 逐项迁移白箱 preview；每个 unsupported method 都有 negative fixture。

no-facade 证据包括：`controller-preview.ts` 不再包含 Euler/wave/plant step；Arena preview numerics 的 generated imports 只通过 client façade；static graph 证明没有 page/import 直接使用旧 model；browser facade 没有 writer 权限；route/store tests 证明 server facade 重算并生成 checksum、拒收 client trace/summary/checksum 且 preview 不写 official tables；R2 identity test 证明 dataset/controller/model/sourceExperiment 关系参与 canonical/checksum 校验；identity 改变不能复用旧结果；surrogate 不能声称 identified；browser smoke 证明 WASM 未 ready 时不可用而非旧值继续跑。

## Migration Plan

1. 验证 R1/R2 identity，冻结 preview 数值 denominator、TS baseline vectors、capability matrix 和 official boundary tests。
2. 在 Rust 增加 black-box preview model capability，复现原固定 loop 的状态和 metric denominator，生成 package 并记录 tolerance。
3. 经 client façade 接入 black-box preview display vertical slice；再让 `/api/arena/virtual-simulation-runs` 经 server façade 重算、checksum 和写入，保留 store/evidence/replay metadata；移除原 TS loop。
4. 逐项接入受支持 white-box preview；不支持的 method 仅暴露 unavailable，不能自动切换 template/heuristic numerics；browser path 永不持久化。
5. 运行 route/replay/evidence/official-isolation、tampered-client、identity-participation、surrogate/identified-parameter tests，交付 R6 的 deleted-numeric candidates。

Rollback 可按 capability 回退到“preview unavailable/disabled”而不是恢复 TS numerical fallback；若需回到旧实现，只能回滚到迁移前完整 commit，并在回滚期间停止新 preview evidence。既有 preview/official 历史记录不重算、不改 visibility。

## Open Questions

无。白箱 method 的最终 `modelId` 由实现时 Rust capability registry 决定；未注册前必须保持 unavailable，不能以名称相近或模板结果宣称支持。
