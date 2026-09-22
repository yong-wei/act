# 深化泡沫、船水接触与五类海域的实际动态品质

## Why
历史泡沫和环境模块已经实现，继续深化应修真实尺度、源采样和动态表现，而不是再建立一套状态框架。完成路线对比也需要相同质量的真实船舶环境。

## What Changes
- 修复粗采样自然泡沫源与纹理“游动”，完善实际船源、局部变形和可控寿命。
- 完成近远场误差/接缝、船体逐自由度接触及五类布局真实消费者。
- 新增改进以实际动态图像和CPU/GPU成本为依据，沿用现有资源交付。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-vessel-interactions`: 扩展既有能力的可执行与验收要求。
- `marine-scene-environments`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
