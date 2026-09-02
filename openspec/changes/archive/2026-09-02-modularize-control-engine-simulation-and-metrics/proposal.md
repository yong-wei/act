## Why

Rust `control-engine/src/lib.rs` 仍把 simulation dispatch、固定步长模型执行、trace/result 组装和 metric 计算与大量请求类型混在一起；`simulation.rs` 只有转发，`metrics.rs` 仅承载少量 helper。C26 将已有 simulation 与 metrics 职责落到独立内部模块，减少根模块的变化原因，同时保持固定步长、数值真源、WASM facade 和结果语义不变。

## What Changes

- 将 `lib.rs` 中真实的 simulation stepping、trace/result aggregation 和 metrics derivation 迁移到已有 `simulation.rs`、`metrics.rs` 或其私有子模块。
- 让 simulation 与 metrics 直接依赖已验证的 Rust inputs/outputs 和 constraints，不复制 TypeScript stepper 或另建 runtime。
- 保持 model id、工程单位、采样间隔、固定步长调度、非有限值/硬约束错误、trace checksum 和现有 result JSON。
- 保持 Arena official evaluator 与 Practice/preview display/persistence 边界，供 C27 在 C25/C26 完成后简化共享纯计算。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-engine-wasm-facade`: 增加 simulation/metrics 内部模块化和结果保持要求，既有 facade/ABI 不变。

## Dependency and Boundary

本变更为 C26。C25 与 C26 可并行处理不同 Rust 职责；C27 必须等待二者均完成并通过验证。C26 不重建 Artifact/Run contract 或 WASM facade，不改变 Arena server authority、preview≠official、固定步长或生产运行时身份。

## Impact

- Rust：`rust/control-engine/src/lib.rs`、`simulation.rs`、`metrics.rs`、相关 constraints/runtime adapters 和 Rust tests。
- Runtime consumers：browser/worker/server control-engine facades、Practice live、virtual preview、Arena analysis and replay.
- 只验证 generated package identity；不手工修改生成的 JS/declarations/WASM，不改变 TS 页面职责。
