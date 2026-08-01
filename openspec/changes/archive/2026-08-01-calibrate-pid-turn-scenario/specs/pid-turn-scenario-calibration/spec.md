# pid-turn-scenario-calibration Specification

## Purpose

为 PID 参数推荐提供一个物理可执行、评分一致且可重放的 90 度转向场景。

## ADDED Requirements

### Requirement: Calibrated turn scenario uses one reference definition

系统 SHALL 使用同一参考航向日程定义推荐器的目标航向、参考轨迹、起点和评测窗口。

#### Scenario: Recommended turn starts at the simulation origin
- **WHEN** 优化器评估默认 90 度转向场景
- **THEN** 仿真和参考轨迹 SHALL 都从 `(0, 0)` 与 0 度航向开始
- **AND** 参考轨迹 SHALL 由该场景的航向日程和船速积分得到

#### Scenario: Recommended turn uses a finite heading transition
- **WHEN** 优化器评估默认 90 度转向场景
- **THEN** 目标航向 SHALL 在 0 至 60 秒保持 0 度
- **AND** SHALL 在 60 至 150 秒线性过渡到 90 度
- **AND** SHALL 在 150 至 240 秒保持 90 度

### Requirement: Recommended turn evaluates actual rudder motion

系统 SHALL 将 PID 输出作为舵角命令，并在推荐场景中以不超过 5 度每秒的实际舵角速率驱动 Nomoto 船模和舵速评分。

#### Scenario: Command requires a faster rudder change than the scenario permits
- **WHEN** 两个连续仿真步的 PID 舵角命令差值大于场景的速率限制乘以步长
- **THEN** 运行时 SHALL 将实际舵角变化限制在该最大差值内
- **AND** `maxRudderRate` SHALL 基于实际舵角计算

#### Scenario: Generic quick simulation omits actuator limits
- **WHEN** `nomoto_quick_sim` 请求未提供舵机速率限制
- **THEN** 运行时 SHALL 保持既有的直接舵角截断行为

### Requirement: Recommended turn measures sustained settling

系统 SHALL 从最终参考航向完成时刻开始，以目标航向正负 5 度容差计算持续稳定时间。

#### Scenario: Response remains inside the tolerance band
- **WHEN** 实际航向在 150 秒后进入 90 度正负 5 度的容差带并保持到 240 秒
- **AND** 首次进入时刻早于 240 秒的最终采样点
- **THEN** 稳定时间 SHALL 等于该采样时刻减去 150 秒

#### Scenario: Response does not remain inside the tolerance band
- **WHEN** 实际航向在验证窗口内没有持续保持在容差带中
- **THEN** 稳定时间 SHALL 计为 90 秒
- **AND** 稳定性评分项 SHALL 计为零分

### Requirement: Calibrated recommendation is achievable

系统 SHALL 在默认搜索范围中包含经校准的可行 PID 参数，并使该场景的可行参数评分达到至少 60 分。

#### Scenario: Calibrated PID candidate is evaluated
- **WHEN** 使用 `kp=3`、`ki=0.001` 和 `kd=5` 评估默认目标
- **THEN** 结果 SHALL 具有不超过 5 度每秒的最大实际舵速
- **AND** 结果 SHALL 具有不超过 90 秒的持续稳定时间
- **AND** 推荐评分 SHALL 不低于 60 分
