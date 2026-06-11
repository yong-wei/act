## Why

React Doctor state/effect error 的剩余部分集中在 legacy interactive-learning resources、widgets 和 simulation resources。它们数量多、历史跨度大，并且仿真组件可能涉及控制语义和数值展示，不能与活跃平台壳层或 manifest-first 课程混在同一实现批次中。

本变更专门处理资源层和仿真层的状态/effect error，要求修复 UI 状态问题时不改变教学内容、仿真数值语义或 widget 行为。

## What Changes

- 修复 `src/resources/interactive-learning` legacy lesson decks 中的 state/effect error。
- 修复 `src/resources/widgets` 中的 state/effect error。
- 修复 `src/resources/simulations` 和 `src/resources/control-system` 中的 state/effect error。
- 增加代表性资源、widget、simulation smoke 验证。
- 使用 React Doctor `0.5.1` 本地 error-only 扫描验证该范围清零。

## Capabilities

### New Capabilities

- `resource-simulation-state-effect-safety`: Defines state/effect safety requirements for legacy resources, widgets, and simulation components.

### Modified Capabilities

- None.

## Impact

- Affects currently flagged files under `src/resources/interactive-learning`, `src/resources/widgets`, `src/resources/simulations`, and `src/resources/control-system`.
- Does not change Rust/WASM simulation kernels, scoring semantics, course content, or manifest-first interactive runtime contracts.
- Validation remains local-only and pins React Doctor to `0.5.1`.
