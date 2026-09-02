## Context

现有 crate 已声明 `simulation` 与 `metrics` 模块，但 `simulation.rs` 主要 re-export `control_odyssey_runtime`/`virtual_simulation_runtime`，`metrics.rs` 仅有通用误差 helper，大部分 simulation loop、trace summary、analysis metric 和 runtime dispatch 仍在 `lib.rs`。这不是新建仿真架构的需求，而是把已有职责从根模块落地到稳定的内部边界。

C26 与 C25 同属 M6-D，分别负责 simulation/metrics 和 analysis/controllers。C27 在两个模块化变更均完成后处理共享计算重复；不能在 C26 中提前做跨职责简化。

## Goals / Non-Goals

**Goals:**

- 让 simulation stepping、trace/result aggregation、metrics derivation 可独立阅读和测试。
- 保持 Rust/WASM 为唯一数值真源，前端仅固定步长调度、状态转换、图表和埋点。
- 保持固定 `dt` 语义、工程单位、sample cadence、checksum、model/protocol identity 和错误状态。
- 让 `lib.rs` 清晰保留 facade/decode/dispatch，并删除已迁移原实现。

**Non-Goals:**

- 不新增 TypeScript 物理 stepper、通用 simulation hook、第二个 WASM facade 或 Artifact/Run contract。
- 不改变 Arena official scoring/evaluation、Practice/preview visibility、server persistence 或历史 replay。
- 不改变算法精度、容差、采样协议、模型 id 或现有 generated runtime ABI。

## Decisions

### 1. Keep fixed-step scheduling outside Rust module ownership changes

Rust moduleization 只移动模型执行、轨迹和 metric 纯计算；页面继续用 `SimulationClock({ dt: 1 / 60, maxSubSteps: 6 })` 调度，WASM 未 ready 时暂停/不可用，不引入 fallback。服务端 virtual preview 仍通过 server facade 计算和持久化。

### 2. Split simulation and metrics by data flow

Simulation 模块拥有 state transition、trace sample 和 model dispatch；metrics 模块拥有从已验证 trace/output 计算的 summary 指标。共享 types/constraints 只在既有 crate contract 中复用；不把 Arena evaluator 的 task scoring、leaderboard 或 hidden scenario policy 移入 metrics。

### 3. Preserve result and failure semantics

迁移前冻结代表性 trajectory、summary、non-finite、hard-constraint、timeout/unavailable 和 checksum cases。迁移后比较完整 JSON、错误分类、sample cadence 和 tolerance；不以空 trace、zero-filled result、stale cache 或 TS heuristic 代替失败。

### 4. Keep sibling changes non-overlapping

C26 只修改 simulation/metrics 符号和直接测试；C25 处理 analysis/controllers。C27 负责两项完成后的共享计算简化与 before/after 账本，C26 不预先删除可能属于 C25 的 helper。

## Risks / Trade-offs

- [Risk] trace sampling or metric ordering changes under move. → Use byte/field-level fixture comparisons and explicit cadence/checksum assertions.
- [Risk] preview-only computations leak into official semantics. → Keep evaluator and server persistence outside the modules; run preview/official isolation tests.
- [Risk] root module keeps hidden duplicate loops. → Require symbol inventory, direct module calls and post-move zero-caller scan.

## Migration Plan

1. 冻结当前 simulation/metrics outputs、errors、sampling、checksum 和 facade identities。
2. 按 simulation dispatch/state/trace 与 metrics aggregation 两类分别迁移，每类迁移后运行 Rust tests。
3. 收缩 `lib.rs`、删除重复实现和无用 imports，不创建转发 wrapper 链。
4. 通过 client/worker/server facade、Practice、Arena preview/official、replay 和 fixed-step tests。
5. 记录 C26 receipt，并将共享计算候选和行为基线交给 C27。

Rollback 恢复本变更单一提交即可；不得恢复前端数值主干、第二套 metrics 或另一套 facade。

## Open Questions

无。若某 metric 同时承担 Arena task scoring，留在 Arena evaluator；不得为方便模块化把官方业务规则塞进 Rust shared metrics。
