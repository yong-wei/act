## Why

在 C25/C26 将 Rust analysis/controllers 与 simulation/metrics 职责落到真实模块后，仍可能保留重复参数校验、simulation loop、metric 计算和数据转换。C27 只对已经模块化且有 characterization 的 canonical implementation 调用 `code-simplification`，以行为保持为前提减少重复逻辑；纯搬文件或再次建立 facade 不构成简化。

## What Changes

- 在 C25、C26 的稳定 revision 上，按一个 shared responsibility 一个分块审查 Rust control-engine 的重复 computation。
- 主动调用并遵循 `code-simplification` skill，保存每个分块的 before/after、行为不变量、public exports、错误语义、bytes/lines、tolerance 和测试结果。
- 合并确实重复且行为等价的 analysis/controller/simulation/metrics 纯计算；删除无价值 wrapper、重复转换和已验证死代码。
- 保留唯一 numerical validator、Rust/WASM 数值真源、固定步长、preview/official 分离、Arena server authority、WASM facade 和现有 Artifact/Run contract。
- 明确禁止以只移动文件、改名或新增转发层伪装简化；不满足可理解性或行为保持时回退该分块。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `control-engine-wasm-facade`: 增加 shared-computation simplification 的证据、等价性和边界要求。

## Dependency and Boundary

本变更为 C27，必须等待 C25 `modularize-control-engine-analysis-and-controllers` 与 C26 `modularize-control-engine-simulation-and-metrics` 均完成。C27 不重建 Artifact/Run contract 或 WASM facade，不扩大到 Arena evaluator、页面 UI、生产部署或其他 Rust crate。

## Impact

- Rust canonical modules：analysis、controllers、simulation、metrics 及其共享纯计算。
- 验证：Rust/facade、Practice、Arena preview/official、replay、fixed-step、generated identity 和 tolerance tests。
- 记录：每个简化分块的 before/after ledger 和 rollback commit；不修改生产 selector 或历史结果。
