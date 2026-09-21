# 修正海洋对照场景并建立可确定重放的实船实验入口

## Why
当前对照页用盒子替代高精船模、FarFieldPlane 未转到 XZ、两路平均水位不同、StandInVessel 始终采样 FFT 且定时器自造时间。相同 p95 不能排除这些场景混杂。应先得到可自动驱动的正确实际场景，不重建实验平台。

## What Changes
- 修复远场方向/覆盖、统一水位和后端对应的船体查询。
- 复用当前 FFT 对照路由、七船型描述符和 MarineFrame，默认实际高精055，盒子仅作显式诊断。
- 暴露有界的 ready/reset/step/scenario/capture 入口，场景/能力/资源身份从实际实例回读。

## Capabilities
### New Capabilities
- `marine-comparison-lab`: 新增实验入口契约。

### Modified Capabilities
None.

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
