# 完整实现WebGPU FFT与Gerstner控制组及等价场景

## Why
WebGPU目前只有navigator.gpu探测。必须交付实际compute/渲染/查询和同等光学；增加同后端Gerstner控制组，才能将算法收益与WebGL/WebGPU后端收益分开。

## What Changes
- 在同一海洋架构增加实际WebGPU/TSL后端，不以forceWebGL回退冒充WebGPU。
- 实现FFT频谱演化、二维IFFT和位移/导数，与WebGL复用同一谱定义。
- 移植完整光学/泡沫/船模/环境/后处理，同时加入WebGPU Gerstner作为控制组。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-spectral-evaluation`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
