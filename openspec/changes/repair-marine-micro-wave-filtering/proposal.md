# 消除规则微波条纹并保留自然波光

## Why

当前微法线为三个固定cos分量，所谓像素脚印仅是距离衰减；截图可见规则细条纹。需要控制空间/时间混叠，不能将用户认可的波光整体抹掉。

## What Changes

- 将实际像素脚印、方向频带和远场粗糙度纳入光学过滤。
- 提升微波的非相干性和尺度连续性，复用现有水材质与质量档。
- 动态镜头和多分辨率对照验证，而不只测试衰减函数单调。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-water-optics`: 微波抗混叠与波光保真。

## Impact

scene/water/micro-optics.ts、gerstner-water-material.ts及对应质量参数；基线fe951b7。详见[复核](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不改变基础几何波/船姿态/数值海况；不要求FFT或更换renderer；不靠全屏模糊、删除高光或过曝修复。
