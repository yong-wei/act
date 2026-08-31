## ADDED Requirements

### Requirement: v2 覆盖审计固定 135 题全阶段分母

系统 SHALL 提供独立于 v1 的 v2 覆盖审计。v2 审计 MUST 以 `micro-tutoring-assessment-baseline-v2` 的 135 道题为固定分母，阶段计数 MUST 为 practice 54、checkpoint 27、remediation 27、readiness/readiness-gate 合计 27，并为每个错误选项生成一行可定位覆盖记录。v1 的 54 题/108 错误选项审计 MUST 保持不变。

#### Scenario: v2 分母与阶段计数一致

- **WHEN** 审计读取当前 v2 基线、目录和审核快照
- **THEN** 输出恰好 135 个合格题目
- **AND** 阶段计数与 v2 基线一致
- **AND** 不得把额外题目静默纳入分母

#### Scenario: v2 错误选项均有完整链路

- **WHEN** 每个 v2 错误选项具有唯一归因、规范节点、可达 v2 资源和独立 v2 验证题
- **THEN** 该选项记录为完整
- **AND** 严格模式在任一行缺口或基线漂移时失败
