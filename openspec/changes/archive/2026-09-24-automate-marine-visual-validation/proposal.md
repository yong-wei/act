# 自动验证真实GPU数值、动态画质与船舶教学语义

## Why
此前大量源码字符串测试和“待人工走查”不能完成自动验收。必须基于实际GPU、确定历史和可观察缺陷判断，通过固定质量契约减少日常人工操作，同时不伪造通用审美分数。

## What Changes
- 建立数值、光学诊断、时空画质和真实场景交互四层自动检查，复用现有Vitest/Playwright。
- 固定初态/时钟/镜头重放与关键图像输出；实际缺功能导致失败。
- 只使用同路线参考或同算法跨后端误差，不把随机不同海浪的像素差当质量分数。

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `marine-fleet-rollout`: 扩展既有能力的可执行与验收要求。

## Impact
基线 `a8ace65f817e2bc3c86bba1a9c8cc8f818f04975`。演进现有海洋scene与实验/测试入口；总体裁决见[单机对照研究](../../../docs/research/2026-09-21-marine-single-host-comparison.md)。任务以本change为准。

## Non-goals
不修改Rust/WASM数值物理、评分或模型/Runtime发布链；不自动部署或切换生产默认后端；不要求购买低性能设备，不创建通用渲染/测试平台。
