# 实现同等功能的Gerstner与FFT水体光学和环境场景

## Why
当前Gerstner拥有GGX/泡沫/颜色转换，FFT只是高度着色，且比较页没有完整环境实例。声明unresolvedDifference不能让不同画质的性能比较变公平。

## What Changes
- 最小提取共用水体光学，波场输入与材质表现分离。
- 两条WebGL路线均具备相同IBL、波光、微法线、泡沫、船体接触、平面反射及浅水能力。
- 以实际功能开关和输出验证完整性，不以低配交集或关闭一切冒充完整实现。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-water-optics`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
