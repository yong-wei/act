# 实现带限多尺度海面与稳定近场采样

## Why

现有 60 km 均匀网格在 high 档间距约 234 m，却采样 9–300 m 波；增加波数不能恢复缺失的几何，需要以采样频带和近场误差重新分配网格。

## What Changes

- 近场交互网格与远场有限 LOD/clipmap，接缝和过渡一致。
- 所有档位共享基础低频波场；短波交给微法线，不让降档改变海况。
- 正确 Gerstner 导数、世界相位、水平位移反解和批量采样。

## Capabilities

### New Capabilities

- `marine-bandlimited-ocean`: 实现带限多尺度海面与稳定近场采样。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
