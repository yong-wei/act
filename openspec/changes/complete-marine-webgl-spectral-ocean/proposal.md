# 完成分辨率无关的WebGL频谱海洋与正确船体查询

## Why
GPU IFFT已存在，但固定5200振幅系数只在一个分辨率标定；高度纹理/网格采样约定、连续场与可见曲面、4Hz异步查询仍未形成正确一致的产品路径。保留现有GPU演化/蝶形，不重新交付候选字符串。

## What Changes
- 统一谱密度、离散积分、归一化、方向与时间相位约定。
- 输出实际高度、水平位移、法线/斜率、压缩及有界多尺度频带。
- 修复周期纹理中心/网格拓扑和批量船体查询，并执行真实GPU数值对照。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-spectral-evaluation`: 扩展既有能力的可执行与验收要求。
- `marine-bandlimited-ocean`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
