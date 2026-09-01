## 1. Baseline and responsibility map

- [ ] 1.1 冻结 `lib.rs` analysis/controller 请求、结果、错误、非有限值和 tolerance fixtures，并记录当前 WASM export/build identity。
- [ ] 1.2 盘点 `lib.rs` 中请求解码、线性/频域分析、PID/structure controller、参数约束和结果组装符号及其 Rust/TS facade callers。
- [ ] 1.3 确认 C26 仅处理 simulation/metrics，标记不属于 C25 的共享符号，不跨任务复制。

## 2. Analysis/controller modularization

- [ ] 2.1 将分析请求验证、分析计算和相关结果组装迁入已有 `analysis.rs` 或其私有子模块，保持公开 JSON 和错误语义。
- [ ] 2.2 将 PID/结构控制器应用、参数边界和 controller-specific helpers 迁入 `controllers.rs` 或其私有子模块，保持单位和 hard constraints。
- [ ] 2.3 让 `lib.rs` 收缩为 facade-facing decode/dispatch/export，删除原实现、无用 imports 和 wrapper 链。
- [ ] 2.4 保持 wasm_bindgen export、model id、generated package identity、client/worker/server facade 和 Arena/Practice consumers 不变。

## 3. Tolerance and boundary verification

- [ ] 3.1 运行 Rust analysis/controller unit/integration tests，比较迁移前后代表性响应、频域结果、参数边界、错误和 non-finite cases。
- [ ] 3.2 运行 control-engine facade、Arena analysis、Practice live、preview/official boundary tests，确认固定步长与 server authority 未改变。
- [ ] 3.3 记录 C25 的 symbol ownership、ABI/export、byte/line 和 tolerance receipt，供 C27 读取。

## 4. Scope guard

- [ ] 4.1 确认未新增 Artifact/Run contract、WASM facade、TypeScript numerical stepper、第二套 validator 或 production deployment。
- [ ] 4.2 运行 `rtk npm run typecheck`（如 TS facade 变更）、`rtk npm run wasm:build:control-engine`、Rust tests、`rtk openspec validate modularize-control-engine-analysis-and-controllers --type change --strict` 和 `rtk git diff --check`。
