## ADDED Requirements

### Requirement: 生命周期覆盖矩阵区分五个评估阶段和多层资格

系统 SHALL 按学习目标、评估阶段和题源生成版本化覆盖矩阵，阶段 MUST 包含 readiness、practice、checkpoint、remediation 和 terminal-validation。每个矩阵单元 SHALL 分别报告登记、人工审核、path eligibility、运行时注册和当前可选择数量，不得把 `allowedStages` 或题目总数解释为实际覆盖。

#### Scenario: v2 矩阵生成

- **WHEN** 系统对当前评估 release 生成生命周期覆盖
- **THEN** 九个受治理学习目标的五阶段 SHALL 均具有明确计数、分母、题源分布、限制和输入摘要
- **AND** 缺少某阶段题目 SHALL 显示为缺口而不是零值成功

#### Scenario: 题目允许 practice 但未人工批准

- **WHEN** 目录题目声明 `low-stakes-practice` 但审核决定未批准对应阶段
- **THEN** 它 SHALL 只计入登记/允许层
- **AND** 不得计入批准或当前可选择层

### Requirement: v2 基线不改写 practice-v1 身份

生命周期 v2 SHALL 使用新的 baseline version、release identity 和逐项内容哈希。既有 54 题 practice-v1 分母、报告和历史答题快照 MUST 保持不可变；v2 的新增、退役、重分类和题源纳入 SHALL 通过显式版本升级记录。

#### Scenario: v2 扩展阶段覆盖

- **WHEN** v2 纳入新的 terminal-validation 或题源项目
- **THEN** v2 release SHALL 记录新分母和变更理由
- **AND** v1 审计继续对原 54 题运行并产生相同结果

#### Scenario: 内容变化未升级基线

- **WHEN** v2 基线项目的当前内容哈希变化但 baseline version 未变
- **THEN** 系统 SHALL 报告内容漂移
- **AND** 严格模式 SHALL 失败

### Requirement: 阶段覆盖不足产生显式 limitation

每个学习目标/阶段的最低覆盖 SHALL 由版本化治理策略声明。现有题目不能满足质量、独立性或审核要求时，系统 SHALL 记录 limitation 和人工补题工作单元，不得使用生成临时题、未审核题或其他阶段题目静默补足。

#### Scenario: terminal validation 无合格题

- **WHEN** 一个学习目标没有达到 v2 策略要求的 terminal-validation 题目
- **THEN** 矩阵 SHALL 将该单元标记 incomplete 并给出可定位限制
- **AND** 路径不得声称具有题目型终结验证
