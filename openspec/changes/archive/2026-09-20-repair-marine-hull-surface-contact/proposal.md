# 补齐七船型实际水面、时钟与姿态接线

## Why

共享模块已存在，但055尾迹查询仍有raw R3F时钟旁路，邮轮通用挂载仍默认waterY=0；GPU岸线波幅衰减未进入同一CPU近场查询。必须验证实际消费者，不能把引用共享组件视为全部完成。

## What Changes

- 七船型按现有DOF所有权统一实际水线/表面/visualTime/epoch消费。
- 区分并收敛表面查询、几何带宽近似和刚体接触三类误差。
- 修正近岸、局部网格移动和船壳排水代理的一致性，保留数值横摇。

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `marine-vessel-interactions`: 实际船体接触与时间所有权闭合。
- `marine-bandlimited-ocean`: 渲染/查询一致性与近远分辨率分配。

## Impact

现有frame/water、船体共享挂载及必要的七船型薄适配；基线fe951b7。[事实依据](../../../docs/research/2026-09-20-marine-series-completion-audit.md)。

## Non-goals

不新增浮力/运动积分器，不覆盖邮轮等数值DOF，不改模型包矩阵/评分。不要把1.25m声明容差当成实测水线误差，也不能要求刚体整条水线逐点等于波面。
