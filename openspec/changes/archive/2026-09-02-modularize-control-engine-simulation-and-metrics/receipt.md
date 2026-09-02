# C26 迁移 Receipt（revision-bound）

基线：`0dbeda27b8`（claim branch 建立点，含 #1856/#1858 squash）。

## 1. 现状核查（task 1.1 / 1.2 / 1.3）

提案写作时（C25 之前）`lib.rs` 7,075 行。C25 落地后核查：**`lib.rs` 已不含任何 simulation/metrics 实现**——

- simulation state stepping / trace assembly：`control_odyssey_runtime.rs`（`compute_simulation_step_json` → `compute_simulation_step_inner`、`discretize_transfer_function`、`step_plant`、PID/Smith/feedforward 项、固定步长采样）。
- simulation model dispatch（model_id → practice live / cruise / arena preview / destroyer hifi）：`virtual_simulation_runtime.rs`（`compute_virtual_simulation_step_json`）。
- metrics derivation：`metrics.rs`（`mean_abs_error` / `max_abs_error`，`reject_non_finite` 边界在 `constraints.rs`）；Arena task scoring 保持在服务端 evaluator，未进入共享 metrics。
- `lib.rs`：仅模块声明 + 5 个 `#[wasm_bindgen]` 导出（decode/dispatch），两个 simulation 导出直调 runtime 模块。

C25/C26 职责不重叠清单：C25 = analysis/controllers（已交付 #1856）；C26 = simulation/metrics（本变更）；共享纯计算去重归 C27，未提前处理。

## 2. 本变更的实际修改（task 2.3）

- 删除 `src/rust/control-engine/src/simulation.rs`：零消费者（全仓 `crate::simulation` / `simulation::` 引用扫描为空）的纯转发 re-export 模块，违反 spec "SHALL NOT add a forwarding wrapper chain"；`lib.rs` 移除 `pub mod simulation;`。
- `metrics.rs` 头注释修正为当前事实（analysis metrics 已随 C25 移出 lib.rs；Arena scoring 不属于本模块）。
- 无行为改动：未触碰任何数值路径、采样协议、checksum 或错误分类。

## 3. Fail-closed 与边界验证（task 3.1 / 3.3）

- Rust `cargo test`：迁移前后同为 **86 passed / 0 failed**（odyssey/virtual/practice/cruise/arena preview 全套原样通过；non-finite `reject_non_finite`、hard constraint、timeout/unavailable 用例未变）。
- WASM 身份：`rtk npm run wasm:build:control-engine` 重建后 `index.js` / `index.d.ts` 与 C25 基线**字节级相同**；exports 五项一致（`compute_simulation_step` / `compute_virtual_simulation_step` 在列）；仅 `index_bg.wasm` 与 buildHash 按构建自然更新。
- 既有失败（非本次引入，integration `36f5670795` 干净 worktree 对照验证）：`arena-preview-control-engine.test.ts` 的 1 个 fs-source 断言（`evaluationVisibility: 'preview'` 字符串缺失，源码级既有债务）。

## 4. Runtime boundary tests（task 3.2）

- practice live server WASM（冻结 tolerance）：`practice-live-control-engine.test.ts` 通过（本树 wasm/identity 一致集下 13/13）。
- facade / server consumers / arena replay：`control-engine-facade` 13、`server-control-engine-consumers`、`arena-replay-service`、`arena-replay-preview-contract`、`simulation-scene-drive-chain` 全部通过（47 passed，另 1 个既有失败见上）。
- `SimulationClock` 固定步长合同由 `simulation-scene-drive-chain.test.ts` 与 interactive practice-live 套件覆盖；preview≠official、hidden inputs、replay 身份断言在 arena replay/preview 套件中原样通过，本 diff 未触碰其实现。

## 5. Symbol ownership（task 3.4，供 C27）

| 职责 | owner 模块 |
| --- | --- |
| analysis（线性/频域/非线性） | `analysis.rs`（C25） |
| controllers（结构/PID 参数 + RL） | `controllers.rs`（C25） |
| odyssey 固定步长 stepping/trace | `control_odyssey_runtime.rs` |
| virtual sim dispatch + practice/arena/destroyer 适配 | `virtual_simulation_runtime.rs`、`practice_live*.rs`、`arena_preview.rs`、`destroyer_hifi*.rs` |
| trace→summary 纯指标 | `metrics.rs` |
| 数值边界 | `constraints.rs` |
| facade decode/dispatch/export | `lib.rs`（74 → 71 行） |

## 6. Scope guard（task 4.1）

未新增 TypeScript physics stepper、Artifact/Run contract、WASM facade、第二 metrics authority 或 production deployment；未改变 Arena evaluator、preview/official 分离、server authority 或历史结果。
