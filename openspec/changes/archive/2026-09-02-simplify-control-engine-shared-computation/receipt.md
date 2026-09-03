# C27 共享计算简化 Receipt（revision-bound）

基线：`f25f361d65`（claim branch 建立点，含 #1856/#1858/#1861 squash）。

## 1. 前置（task 1.1 / 1.2）

- C25 receipt：`archive/2026-09-02-modularize-control-engine-analysis-and-controllers/receipt.md`（symbol ownership / ABI / bytes / tolerance）。
- C26 receipt：`archive/2026-09-02-modularize-control-engine-simulation-and-metrics/receipt.md`（simulation/metrics ownership / 86 测试 / fail-closed）。
- Characterization：`cargo test` 基线 **86 passed / 0 failed**（tolerance、频域、根轨迹、Nyquist、PID 边界、non-finite fail-closed、RL 契约全套）。

## 2. Candidate ledger 与 skill 判定（task 1.3 / 2.1 / 2.2 / 2.3）

按 `code-simplification` skill 逐块判定（行为不变量：每输入同输出、同错误语义、同副作用顺序、测试不改即过）：

| # | 分块 | 判定 | 依据 |
| --- | --- | --- | --- |
| 1 | `compare_f64` → `f64::total_cmp`（9 调用点） | **accepted** | 函数体即 `left.total_cmp(&right)`，纯别名 wrapper；排序/极值语义逐点等价 |
| 2 | `point_from_complex` 并入 `complex_to_point`（2 调用点） | **accepted** | 字节级相同实现（duplicate-body 扫描唯一命中对） |
| 3 | `compute_time_metrics` 三处 `ControlMetrics` 字面量 → `default_control_metrics()` / struct update | **accepted** | 前两处字段逐项等于 default（仅 final_value 覆盖）；第三处余字段全 None |
| 4 | `root_locus_segments` 冗余参数 `near_zero_segments` | **accepted** | 唯一调用点传 `&near_zero_plan.segments`；函数内直接读 plan |
| 5 | `root_locus_mu_sequence(config)` 从 per-root 循环提出 | **accepted** | 纯函数、确定性，循环内重复构造同一 Vec；结果逐点不变 |
| 6 | `controllers.rs` `clamp` → `f64::clamp` | **rejected-no-simplification** | NaN 语义不同：自定义 `max/min` 链把 NaN 收敛到 min（掩盖），std 返回 NaN；且 min>max 时 std panic。不满足「every input 等价」硬门槛；wrapper 3 行语义单一，保留 |

补充扫描：`duplicate-body` 检测（<400 字节函数体）全 crate 仅命中 #2，候选面完整。未发现跨模块重复纯计算需要合并（C25/C26 已按职责分界）。

## 3. Before/after（task 2.4 / 3.1 / 4.1）

- 唯一改动文件：`rust/control-engine/src/analysis.rs`，**+20/−57 行（净 −37）**；crate production bytes 下降，无新增文件、无转发层、无改名搬移。
- 增量验证（skill step 3）：块 1+2 → 86/86；块 3 → 86/86；块 4+5 → 86/86；最终 86 passed / 0 failed / 0 warning（含 tolerance 用例 `analysis_metrics_stay_finite_within_declared_tolerance` 原样通过）。
- 回滚：本变更单一提交 revert 即恢复。

## 4. ABI / facade / 边界（task 3.2 / 3.3 / 4.2）

- WASM 重建：`index.js` / `index.d.ts` 与基线**字节级相同**；五项 exports 一致；仅 `index_bg.wasm` + buildHash 按构建更新。
- TS 边界套件：control-engine facade 13、server consumers、practice-live（冻结 tolerance）通过；arena-preview 29 中 1 失败为已知既有 fs-source 断言（integration `36f5670795` 干净树对照，见 C26 receipt），与本变更无关。
- `rtk npm run typecheck` exit 0。
- 未修改 Artifact/Run contract、WASM facade、ABI/model id、Arena evaluator、production selector、历史结果；未删除唯一 numerical validator（`constraints.rs` untouched）。

## 5. Ponytail review（task 3.3）

提交前 staged review 见交付 PR 描述（accepted/rejected 记录见上表 ledger）。
