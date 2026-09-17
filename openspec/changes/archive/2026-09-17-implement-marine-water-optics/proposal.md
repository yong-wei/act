# 实现微尺度水体光学与分级反射

## Why

当前纯色 Fresnel、固定高光与 alpha=0.94 无法表现真实海水；增加有依据的法线细节和同源环境反射，比直接启用昂贵的全场反射更适合 ACT。

## What Changes

- 介质 Fresnel/GGX、分尺度微法线与远场抗闪烁。
- 默认不透明深海；浅水按需深度吸收与折射。
- 可选受预算约束的近景平面反射、自然泡沫和船水互动输入槽。

## Capabilities

### New Capabilities

- `marine-water-optics`: 实现微尺度水体光学与分级反射。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
