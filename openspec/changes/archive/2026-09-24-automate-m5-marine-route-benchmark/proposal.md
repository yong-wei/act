# 交付M5单机一键验证、压力扫描与同质量成本选型

## Why
用户只有M5 Mac，已明确不以购买低端设备作为项目条件。完整路线和自动测试要在该真实GPU上闭环，用实际成本/压力/质量曲线支撑选择，外部设备兼容只作为覆盖限制。

## What Changes
- 一个入口自动运行完整四组合、质量验证、真实成本和受限配置测试并产出报告。
- 取消低端/移动真机与日常人工验收门槛，明确模拟与真实硬件的区别。
- 修复hardwareContext硬编码null、缺一路作废所有已测路线和空证据keep-current-path判定。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-render-performance`: 扩展既有能力的可执行与验收要求。
- `marine-spectral-evaluation`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
