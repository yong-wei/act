# 独立验证 FFT 海洋与 WebGPU/TSL 的投入产出

## Why

频谱波场和 WebGPU 值得验证，但未经同场景比较就重写渲染器会把海面需求扩大为全栈迁移。本项交付证据和取舍，不承诺迁移。

## What Changes

- 同一相机/船模/光照/像素预算下比较混合 Gerstner、WebGL FFT 与可用的 WebGPU FFT。
- 检查海况统计、重复纹理、CPU 水面查询、交互兼容、首载和持续成本。
- 输出采用/不采用/延期判断，禁止自动改生产默认后端。

## Capabilities

### New Capabilities

- `marine-spectral-evaluation`: 独立验证 FFT 海洋与 WebGPU/TSL 的投入产出。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。本项仅作独立研究验证，不修改生产默认后端。
