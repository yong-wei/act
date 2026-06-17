## Why

互动课程已经出现课程私有面板、万能 `interactive-figure` 入口和共享控制工作台能力重叠的问题。Product Design 合同要求数值计算、控制分析、时域、频域、根轨迹、Nyquist、性能指标和 Rust/WASM 分析面板统一复用现有控制工作台，不允许为单课复制一套近似实现。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 将互动课程中的控制分析能力声明为共享 `compute.panel` capability，而不是课程私有视觉模块。
- 明确 `control-workbench`、`control-linked-comparison`、`control-root-locus-design-map`、`control-frequency-reading-workbench`、`nonlinear-analysis-workbench`、`training-workbench` 的注册和分发合同。
- 增加验收闸门: 新课程不得通过 `interactive-figure` 或 `src/features/interactive/unit-*` 私有面板重复实现已有控制工作台能力。
- 要求课程内控制工作台嵌入同时提供深浅色截图、学生端/教师端截图、参数探索证据和教师诊断数据。

## Capabilities

### Modified Capabilities

- `interactive-module-taxonomy`
- `control-workbench-contracts`
- `interactive-governance-evidence`

## Impact

- 影响 manifest runtime 的 compute capability 注册、课程实现门禁和控制工作台嵌入方式。
- 不重做 Rust/WASM 数值内核，不重写已有控制工作台面板。
- 阻塞后续所有需要控制分析面板的互动课程视觉组件改造。

## GitHub Coordination

- Parent issue: `#559`
- Executable issue: `#560`
- Planned dependency: first executable change in the series.
