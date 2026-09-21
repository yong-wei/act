# 测量真实GPU/CPU分项成本、查询延迟与吞吐量

## Why
新M5实测两路均受vsync约束，p95同为17.4ms不能证明成本相同。应演进现有探针/采集脚本，测真实执行成本并保留整场验证，避免以帧率或CPU提交时间冒充GPU耗时。

## What Changes
- WebGL timer query及WebGPU timestamp query实际接通；缺失时自动使用有标签的完成吞吐量路径。
- 分开测CPU、Worker、GPU生成/渲染/泡沫/反射和整场成本。
- 实现有界离屏批次测量与负载/资源计数，避免刷新率封顶。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-render-performance`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
