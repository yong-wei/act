# 完成水面环境反射、天空辐射与雾的实际接线

## Why

当前PMREM只接入scene.environment供船模PBR使用；自定义水shader仍将Fresnel混向纯色horizon。已有GGX波光值得保留，但它不能证明原设计要求的天空/云倒影已完成。

## What Changes

- 共享辐射实际进入水材质，天空可见内容与探针一致，太阳及雾同源。
- 天空随相机消除错误平移视差，世界环境物保持锚定。
- 提供一个实际可启用、受预算约束的高档近景平面反射路径，保留默认低成本环境反射。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-sky-lighting`: 可见天空、船体和水面的共同辐射。
- `marine-water-optics`: 真正的环境/平面反射消费者。

## Impact

现有environment、water和必要的post/quality接口；基线fe951b7。[差距证据](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不强制WebGPU/SSR/体积云，不改船模材质为统一金属光泽，不重做资产交付。不能以禁用全部反射pass、无分配为完成反射验收。
