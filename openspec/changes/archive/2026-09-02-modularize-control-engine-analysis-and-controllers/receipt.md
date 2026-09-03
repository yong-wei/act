# C25 迁移 Receipt（revision-bound）

基线：`fe0abd27289fe5d6acc7fffa136881bb08e64159`（`origin/integration`，claim branch 建立点）。
本 receipt 供 C26 汇合与 C27 共享计算简化读取。

## 1. Symbol ownership（task 1.2 / 1.3）

### 迁入 `analysis.rs`（线性/频域 + 非线性分析）

- 请求/结果类型：`TransferFunctionSpec`、`TimeRangeConfig`、`FrequencyRangeConfig`、`NyquistPlotMode`、`NyquistConfig`、`RootLocusConfig`、`SamplingMode`、`FeasibleRegionConfig`、`ResponseType`、`ControlAnalysisRequest`、`CurvePoint`、`ComplexPoint`、`NyquistSamplePoint`、`RootLocusSamplePoint`、`RealAxisSegment`、`RootLocusAsymptote`、`RootLocusSegment*`、`RootLocusEvent*`、`RootLocusStructuredSegment`、`RootLocusBranch*`、`RootLocusView(s)`、`RootLocusFiniteZeroCoverage`、`RootLocusDiagnostics`、`RootLocusAngle`、`ControlMetrics`、`PhaseCrossoverStatus`、`StepResponseData`、`BodeAxisData`、`Nyquist*`、`RootLocusData`、`ControlAnalysisResult`、`FrequencyResponseReading`、`NonlinearAnalysisRequest/Result` 及非线性结果类型、`TransferFunction`。
- 实现：poly/TF 代数（`trim_leading`…`linspace`）、`build_loop_tf`、`build_root_locus_tf`、`compute_time_metrics`、state-space/step response、Nyquist 轮廓与判据、root locus 全套、`margins`、`frequency_response`、`exact_frequency_readings`、`compute_analysis_inner`、非线性六类计算（phase plane / describing function / negative inverse / harmonic / characteristic / turning radius）与 `compute_nonlinear_analysis_inner`。
- 既有 `analysis_request_errors` 保留原位。
- 测试：36 个 analysis/Rust 用例（含 fixture `unit_1_5_gain_request`、`ship_heading_request`、`platform_pitch_request`、`unit_3_3_step_05_request`、`relative_close`、tolerance 与 fail-closed 用例）。

### 迁入 `controllers.rs`（控制器参数应用 + RL 控制器训练）

- 类型：`StructureSpec`、`RlTrainingRequest`、`RlRewardPoint`、`RlTrainingState`、`RlComparisonPoint`、`RlTrainingMetrics`、`RlTrainingResult`。
- 实现：`tf_from_structure`（gain/p/pi/pd/pid/lead/lag/lead_lag → TF）、RL 块（`clamp`、`seeded_noise`、`parameter_strings`、`parameter_numeric`、`discrete_index`、`greedy_action_index`、`append_reward_point`、`absolute_decay_epsilon`、toy/heading Q-learning、Nomoto 步进、`pid_rudder_command`、`rl_rudder_command`、`evaluate_heading_policy`、`compute_rl_training_inner`）。
- 测试：5 个 RL 用例。

### 留在 `lib.rs`（facade）

- 模块声明、`use` 汇入、5 个 `#[wasm_bindgen]` 导出（decode/dispatch/export）。`compute_simulation_step`/`compute_virtual_simulation_step` 转发不动（属 C26 边界）。

### C26 边界标记（task 1.3）

`control_odyssey_runtime`、`virtual_simulation_runtime`、`practice_live*`、`destroyer_hifi*`、`arena_preview`、`simulation.rs`、`metrics.rs`、`constraints.rs` 全部未触碰；`compute_simulation_step`/`compute_virtual_simulation_step` 分发保持原样。共享符号 `TransferFunction`/`tf_mul` 归 analysis 所有（controllers 经 `crate::analysis` 引用），未复制实现。

## 2. ABI / export / build identity（task 1.1 / 3.3）

基线 identity（`fe0abd2728`）：buildHash `875e93e2…`；`index.js` `f034d1b2…`；`index.d.ts` `8760847e…`；`index_bg.wasm` `e18df072…`。

迁移后（`rtk npm run wasm:build:control-engine` 重建）：

- `wasmExports` 列表逐项一致：`compute_analysis`、`compute_nonlinear_analysis`、`compute_rl_training`、`compute_simulation_step`、`compute_virtual_simulation_step`。
- `index.js` 与 `index.d.ts` 与基线字节级相同（sha256 一致，见 identity.json diff：仅 `index_bg.wasm` 与 buildHash 变化）。
- `index_bg.wasm` 924284 → 929095 bytes（内部符号随模块路径变化，预期）；生成物均由官方构建脚本产出，未手工修改。

## 3. Bytes / lines（task 3.3）

- `lib.rs` 7075 → 74 行；`analysis.rs` 11 → 5811 行；`controllers.rs` 4 → 1246 行。
- 内容保真校验：原 `lib.rs` 行多重集 vs 三个新文件，除 `pub(crate)` 可见性、测试内 `analysis::` 路径改本地调用、fmt 对 3 条长行的折行、模块头/导入外，无任何行丢失或新增实现。

## 4. 测试与 tolerance（task 3.1 / 3.2）

- `cargo test`（host）：迁移前后同为 86 passed / 0 failed（lib 41 = analysis 36 + controllers 5，其余模块 45 不变）。
- tolerance 用例 `analysis_metrics_stay_finite_within_declared_tolerance`（final_value 1e-6/1e-3、overshoot 1e-4/5e-3）与全部频域/根轨迹/Nyquist、PID 参数边界（`direct_pd_correction_does_not_add_cancelled_origin_pole_or_zero` 等）、non-finite fail-closed 用例原样通过。
- facade/Arena/Practice 边界由仓库级套件在干净提交上复跑（见 PR 描述）。

## 5. Scope guard（task 4.1）

未新增 Artifact/Run contract、WASM facade、TypeScript numerical stepper、第二套 validator 或 production deployment；生产运行时未发布。
