# Delta: canonical-knowledge-learning-fact-identity

## ADDED Requirements

### Requirement: Historical fact identity audit inventory
系统 SHALL 对历史 LearningFact 的知识身份产出可审计清单，按账号区分「可确定回填/映射」「只能映射到 legacy」「无法确定」三类；审计报告 SHALL 包含输入、规则、执行 revision、前后计数摘要与异常记录，且为只读不可变输出。

#### Scenario: Audit classifies historical facts
- **WHEN** 对同时包含旧版、当前版与缺失身份事实的学生账号执行身份审计
- **THEN** 报告 SHALL 逐事实给出三分类归属与判定依据（serving 投影与 crosswalk 索引）
- **AND** 报告 SHALL 记录执行 revision、前后计数摘要与异常记录
- **AND** 审计 SHALL NOT 修改任何事实行

#### Scenario: Audit is repeatable
- **WHEN** 同一账号在数据未变化时重复执行审计
- **THEN** 两次报告的分类结果与计数摘要 SHALL 一致

### Requirement: Unrecoverable-identity facts are isolated idempotently
无法可靠恢复知识身份的事实 SHALL 被隔离到零权重上下文集合，不得参与要求当前版本可比性的高置信度个性化；隔离操作 SHALL 幂等且可审计——重复执行不产生新事实、不重复计数、不改变已确认来源，且 SHALL NOT 向历史行写入 CANONICAL 身份列。

#### Scenario: Isolation is idempotent
- **WHEN** 对同一账号重复执行身份隔离
- **THEN** 第二次执行 SHALL 不产生新事实、不重复计数、不改变已确认来源
- **AND** 治理记录 SHALL 以 append-only 形式保留每次执行的输入与结果

#### Scenario: Isolated facts stay out of high-confidence personalization
- **WHEN** 事实被判定无法确定身份并隔离
- **THEN** 该事实 SHALL NOT 被伪装成当前版本证据
- **AND** SHALL NOT 进入要求单版本可比性的高置信度推荐

#### Scenario: Isolation is recoverable
- **WHEN** 需要回退隔离操作
- **THEN** 系统 SHALL 能依据治理记录恢复隔离前状态
- **AND** 恢复路径 SHALL 随迁移前后数据质量报告一并交付

# Delta 说明：本 change 不修改「Historical facts remain Legacy-bound」的禁回填条款；任何 CANONICAL 回填须单独立项并先修订该条款。
