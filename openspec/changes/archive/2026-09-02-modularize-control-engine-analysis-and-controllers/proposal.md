## Why

Rust `control-engine/src/lib.rs` 仍集中承载请求解码、线性分析、控制器参数应用、结果组装和 WASM 导出；现有 `analysis.rs` 与 `controllers.rs` 只有薄占位边界。该结构让分析和控制器的变化原因混在 facade 中，难以独立测试和安全简化。C25 将真实职责移入已有模块，同时保持既有 WASM facade 和结果合同不变。

## What Changes

- 将 `lib.rs` 中真实的 control-analysis 与 controller implementation 按职责迁移到 `analysis.rs`、`controllers.rs` 或同一 crate 内必要的私有子模块。
- 让 `lib.rs` 保留清晰、稳定的 facade/export 和请求分发，不保留多层转发 wrapper 链。
- 为分析、PID/结构控制器和参数边界保留现有错误语义、非有限值拒绝、单位、模型 id、输出字段和 tolerance 行为。
- 以每类职责独立的 Rust tests 和现有 WASM/facade tests 验证，供 C27 的共享计算简化使用。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-engine-wasm-facade`: 增加内部 analysis/controller 模块化要求，保持对 client、worker、server 的 facade/ABI 兼容。

## Dependency and Boundary

本变更为 C25。C25 与 C26 可并行处理不同 Rust 职责；C27 必须等待 C25 和 C26 都完成并通过各自验证。不得重建现有 Artifact/Run contract 或 WASM facade，不改变 Arena server evaluator、preview/official 边界、固定步长或生产运行时身份。

## Impact

- Rust：`rust/control-engine/src/lib.rs`、`analysis.rs`、`controllers.rs` 及相关 analysis/controller tests。
- Generated runtime：仅在导出 ABI 或构建 identity 合同要求时同步验证，不手工修改生成包。
- 保持 `src/lib/control-engine/client.ts`、`server.ts` 的既有 facade API、公开 model id、单位和错误状态。
