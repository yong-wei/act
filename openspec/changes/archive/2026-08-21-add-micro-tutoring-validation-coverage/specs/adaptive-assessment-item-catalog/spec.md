## ADDED Requirements

### Requirement: 目录显式登记微辅导验证用途

评估目录 SHALL 将“可作为微辅导验证候选”作为独立人工审核用途，而不是由一般 `allowedStages`、path eligibility 或 remediation/checkpoint 标签推断。审核决定 MUST 绑定内容哈希、学习目标、规范节点、适用错因、难度、变式独立性和 metadata version。

#### Scenario: 审核者批准验证用途

- **WHEN** 审核者确认一个目录题目适合特定节点和错因的微辅导验证
- **THEN** 目录 SHALL 记录版本化验证用途决定及依据
- **AND** 内容、答案、节点或审核版本变化 SHALL 使决定 stale

#### Scenario: 题目只有一般 path eligibility

- **WHEN** 题目为 path-eligible 但没有当前微辅导验证用途决定
- **THEN** 它 SHALL 保持可用于原阶段
- **AND** 不得进入微辅导验证登记
