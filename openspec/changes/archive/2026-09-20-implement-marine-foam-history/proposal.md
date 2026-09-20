# 实现自然白浪与船舶泡沫的持续生成、输运和消散

## Why

当前自然泡沫仍由80m重复纹理乘波峰遮罩生成；用户实际看到重复图案漂过。船舶泡沫则仍是独立unlit additive粒子，尚未完成原#2100/#2101的统一材质和生命周期目标。

## What Changes

- 在现有水/尾迹模块接入有界历史泡沫密度，区分自然压缩、船艏/舷侧、推进器源。
- 实际消费密度的水面着色，形态纹理采用多尺度/随机采样；保留当前GGX波光。
- 统一受光泡沫、源历史、重定位和暂停/重置行为，落实多推进器硬性全场预算。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-water-optics`: 持续泡沫真实运行与去重复外观。
- `marine-vessel-interactions`: 船体源沉积与全场硬预算。

## Impact

基线integration@fe951b7；主要修改scene/water、scene/wake及必要的共享profile接线。事实与原项差距见[复核](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不改数值水动力、控制器、评分、船模发布链；不依赖FFT/WebGPU迁移；不新建通用效果/证据框架。仅更换贴图、声明源类型或生成空报告不构成交付。
