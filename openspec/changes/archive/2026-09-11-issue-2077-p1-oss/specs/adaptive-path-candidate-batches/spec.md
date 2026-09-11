## ADDED Requirements

### Requirement: Diversity failure uses a named limitation
当可用已发布/OSS 资源不足以同时满足恰好三条候选与硬区分度门禁时，系统 SHALL 返回 `insufficient-candidate-diversity` 及原因。该结果 SHALL NOT 以成功的三条近乎相同候选批次呈现。

#### Scenario: Soft differences are not a successful three-path batch
- **WHEN** 规划器能序列化三个策略标签，但硬门禁（Jaccard 相似度、独有已发布资源数与占比、前半段独有、前两个非强制资源）未全部满足
- **THEN** 结果 SHALL 包含 `insufficient-candidate-diversity`
- **AND** 消费者 SHALL NOT 得到一张被标为成功的三卡伪差异批次。

## MODIFIED Requirements

### Requirement: Candidate batches keep only material path differences

Persisted adaptive-path candidate batches SHALL include only executable candidates whose material facts differ. Material facts are node identity and order, personalizable resource mix, estimated effort, checkpoints, and terminal validation. Title, description, explanation, score, and client display order SHALL NOT create a new candidate. Shared required prerequisite or terminal-validation nodes MAY be identical.

#### Scenario: Title-only duplicates are rejected

- **WHEN** two generated options differ only in label, description, or score
- **THEN** the batch SHALL persist one candidate
- **AND** it SHALL record a diversity limitation explaining the reduction

#### Scenario: Shared required nodes remain distinct options

- **WHEN** two options share terminal-validation nodes but differ in remaining node identity, order, resource mix, or effort
- **THEN** both candidates SHALL remain in the batch

#### Scenario: Resource coverage is insufficient

- **WHEN** material facts or hard OSS diversity gates cannot support three distinct executable options
- **THEN** the system SHALL NOT persist a successful three-candidate batch of near-identical paths
- **AND** it SHALL expose `insufficient-candidate-diversity` instead of fabricating another card

### Requirement: Candidate batches honor the target option count
成功生成的不可变候选批次 SHALL 与路径规划合同共享同一目标候选数；当策略族请求存在且硬区分度门禁通过时，批次 `candidateCount` SHALL 等于 3。

#### Scenario: Generation persists exactly three candidates
- **WHEN** 一次成功生成因冷启动或低置信自动注入 starter 策略族并持久化候选批次，且硬区分度门禁通过
- **THEN** 该批次的 `candidateCount` SHALL 等于 3
- **AND** 每个候选的 `ordinal` SHALL 在 1..3 范围内连续
- **AND** 批次 SHALL NOT 包含主规划族额外追加的第 4 条候选。

#### Scenario: Adjusted derivation preserves the option count
- **WHEN** 学生基于既有批次发起候选调整并派生新批次
- **THEN** 派生批次 SHALL 沿用同一目标候选数与硬区分度约束，除非规划器显式返回低资源或 `insufficient-candidate-diversity` 状态
- **AND** fallback 状态 SHALL 在批次 metadata 中如实记录，不得以追加候选或复制路径补足数量。
