## ADDED Requirements

### Requirement: 仿真循环 effect 引用稳定且时钟守恒

仿真页面的推进循环 SHALL 使用稳定引用：回调与启动 effect 的依赖不得包含每帧变化的状态；运行期间 MUST NOT 因 effect 重建而重置固定步长 accumulator 或重定时间基线。1.0x 倍速下，正常帧率时仿真时钟与墙钟的偏差 SHALL 小于 5%。

#### Scenario: 一倍速时钟近似实时

- **WHEN** 以 1.0x 运行仿真 60 秒（正常帧率）
- **THEN** 仿真时钟读数与墙钟偏差小于 5%
- **AND** 控制与数值行为不因调度改动而变化

#### Scenario: 运行期间循环不被状态更新重建

- **WHEN** 仿真运行中每帧状态更新触发渲染
- **THEN** 推进循环的 effect 不 teardown/重建
- **AND** accumulator 余数跨帧保留，不被 reset 丢弃
