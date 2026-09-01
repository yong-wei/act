## 1. Baseline and responsibility map

- [ ] 1.1 冻结当前 simulation state transition、trace sample、summary metrics、checksum、non-finite/error、timeout/unavailable 和 tolerance fixtures。
- [ ] 1.2 盘点 `lib.rs` 中 simulation dispatch/loop、trace/result aggregation、metrics derivation 与 constraints 的符号及 Rust/TS facade callers。
- [ ] 1.3 与 C25 对齐不重叠的职责清单；共享 helper 暂留其当前 owner，交由 C27 统一审计。

## 2. Simulation/metrics modularization

- [ ] 2.1 将 simulation model dispatch、state stepping、trace sampling 和结果组装迁入 `simulation.rs` 或私有子模块。
- [ ] 2.2 将 trace/output 到 summary metric 的纯计算迁入 `metrics.rs` 或私有子模块，保持指标含义、顺序和错误语义。
- [ ] 2.3 让 `lib.rs` 收缩为 facade/decode/dispatch，删除原 simulation/metrics 实现、无用 imports 和 forwarding wrapper 链。
- [ ] 2.4 保持现有 wasm_bindgen exports、generated identity、model/protocol/runtime/controller schema 与 server/client facade 合同。

## 3. Runtime boundary verification

- [ ] 3.1 运行 Rust simulation/metrics tests，比较轨迹、采样节奏、summary、checksum、non-finite、constraint 和 tolerance。
- [ ] 3.2 运行 `SimulationClock` fixed-step、browser/worker display-only、server preview persistence、Arena official evaluator 和 replay tests。
- [ ] 3.3 验证 preview≠official、server authority、hidden inputs、historical result 和 fallback fail-closed 语义未改变。
- [ ] 3.4 记录 C26 的 symbol ownership、bytes/lines、ABI/export 和 numerical receipt，交给 C27。

## 4. Scope guard

- [ ] 4.1 确认未新增 TypeScript physics stepper、Artifact/Run contract、WASM facade、second metrics authority 或 production deployment。
- [ ] 4.2 运行 `rtk npm run typecheck`（如 TS facade 变更）、`rtk npm run wasm:build:control-engine`、Rust tests、`rtk openspec validate modularize-control-engine-simulation-and-metrics --type change --strict` 和 `rtk git diff --check`。
