# 建立真实硬件预算、渐进加载与自适应画质

## Why

现有 CPU 线程分档与整组降级无法区分瓶颈，也不能证明高精船模下的 1080p60。需要将真实测量、资源寿命和视觉不变性纳入同一预算治理。

## What Changes

- 复用现有 quality governor 与模型 LOD，增加物理像素、逐效果增量和生命周期观测。
- 避免降档改变基础海况，优先降低额外 pass/DPR/透明效果。
- 真实硬件场景基线、资源释放和最小充分验证。

## Capabilities

### New Capabilities

- `marine-render-performance`: 建立真实硬件预算、渐进加载与自适应画质。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
