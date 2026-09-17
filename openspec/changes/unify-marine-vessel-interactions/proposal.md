# 统一船体水线、尾流、推进器洗流与贴水标注

## Why

精细船模如果悬浮、船壳穿水、双桨尾迹预算翻倍或平台零速无洗流，环境可信度仍然不足；互动必须共享几何波场并尊重各船教学状态。

## What Changes

- 按 DOF 所有权整合水线与展示性船姿态，保留数值横摇等数据。
- 语义推进器驱动分类型尾流/局部洗流，共享每场景预算。
- 渲染专用船壳排水代理、湿润带、受光泡沫及统一贴水线。

## Capabilities

### New Capabilities

- `marine-vessel-interactions`: 统一船体水线、尾流、推进器洗流与贴水标注。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
