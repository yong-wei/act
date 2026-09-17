# 统一天空、环境辐射与船体光照

## Why

现有天空图像、方向光和海面颜色只是并置，水面太阳方向未与预设一致，船模缺少在该环境组件中统一建立的 IBL。高精模型需要一致光照才能呈现材质层次。

## What Changes

- 同源天空/太阳/雾/曝光与船体、水面 PMREM。
- 缓存环境辐射，匹配 Three 版本的 CubeUV 采样与单次色彩输出。
- 主体区域拟合的稳定太阳阴影，校准现有船模 PBR，不破坏资产语义。

## Capabilities

### New Capabilities

- `marine-sky-lighting`: 统一天空、环境辐射与船体光照。

### Modified Capabilities

None. Existing shared visual-pipeline invariants remain in force.

## Impact

演进现有 `src/resources/simulations/scene/` 及必要的 profile/挂载适配；细节见 design。代码调查基线 `37a988f5928d73c2af7eabad57284a771c9d3519`。共同依据见[研究与技术裁决](../../../docs/research/2026-09-17-marine-environment.md)。

## Non-goals

本项不改 Rust/WASM 物理模型、控制器、评分、模型资产发布链或生产部署。不新增第二套通用仿真/状态框架。不在本项引入 WebGPU 强制迁移或全海域流体求解。
