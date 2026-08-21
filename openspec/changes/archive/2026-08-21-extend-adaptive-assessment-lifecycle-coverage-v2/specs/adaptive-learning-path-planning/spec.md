## ADDED Requirements

### Requirement: 路径规划支持受治理的题目型 terminal validation

路径规划 SHALL 将题目型 `terminal-validation` 作为独立评估 scope，并仅选择当前 lifecycle baseline 中人工批准、path-eligible、运行时已注册且与目标和路径 identity 一致的题目。题目型验证 MAY 与仿真或 Arena 终结验证组合，但不得替代策略要求的其他终结证据。

#### Scenario: 路径请求题目型终结验证

- **WHEN** 当前路径策略要求题目型 terminal validation 且存在合格候选
- **THEN** 规划器 SHALL 返回受版本约束的评估节点和解释
- **AND** 选择后 SHALL 使用不可变评估题目快照

#### Scenario: 只有 provisional 或其他阶段题目

- **WHEN** 目标没有合格 terminal-validation 候选，但存在 generated-provisional、practice 或 checkpoint 题目
- **THEN** 规划器 SHALL 返回缺失终结验证的低置信度或受控 fallback
- **AND** 不得把其他阶段题目静默替代为 terminal validation
