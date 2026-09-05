## ADDED Requirements

### Requirement: Candidate batches honor the target option count
成功生成的不可变候选批次 SHALL 与路径规划合同共享同一目标候选数；当策略族请求存在且资源多样性可用时，批次 `candidateCount` SHALL 等于 3。

#### Scenario: Generation persists exactly three candidates
- **WHEN** 一次成功生成因冷启动或低置信自动注入 starter 策略族并持久化候选批次
- **THEN** 该批次的 `candidateCount` SHALL 等于 3
- **AND** 每个候选的 `ordinal` SHALL 在 1..3 范围内连续
- **AND** 批次 SHALL NOT 包含主规划族额外追加的第 4 条候选。

#### Scenario: Adjusted derivation preserves the option count
- **WHEN** 学生基于既有批次发起候选调整并派生新批次
- **THEN** 派生批次 SHALL 沿用同一目标候选数约束，除非规划器显式返回低资源 fallback 状态
- **AND** fallback 状态 SHALL 在批次 metadata 中如实记录，不得以追加候选补足数量。
