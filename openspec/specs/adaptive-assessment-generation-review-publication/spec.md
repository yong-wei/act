# adaptive-assessment-generation-review-publication Specification

## Purpose
TBD - created by archiving change govern-adaptive-assessment-generation-review-publication. Update Purpose after archive.
## Requirements
### Requirement: 生成题候选保存真实生成溯源和不可变修订

系统 SHALL 将模板、AI 和人工生成题保存为持久候选，并以明确 generation kind 区分来源。每个候选修订 MUST 绑定 provider/model/config、prompt template version、输入知识来源引用与哈希、生成参数、内容哈希、父修订和创建者/服务身份；敏感原文 SHALL 保存在受限边界，公开治理记录仅保留必要身份与摘要。

#### Scenario: AI 生成候选被保存

- **WHEN** 授权生成服务使用模型产生题目候选
- **THEN** 系统 SHALL 创建不可变候选修订和完整生成包络
- **AND** 该候选不得直接进入学生正式评估或目录发布

#### Scenario: 固定模板产生临时练习

- **WHEN** 现有模板生成器构造低风险练习
- **THEN** 响应 SHALL 使用 truthful template generation kind
- **AND** 不得继续将其标记为 AI 生成或发布候选

### Requirement: 自动预检与人工审核权力分离

系统 SHALL 对候选执行答案正确性、干扰项唯一性、公式/图形渲染、学习目标/规范节点对齐、难度、泄题和安全预检。脚本或模型检查 MUST 只产生 findings/suggestions；只有具备授权的独立人工审核决定可以批准、拒绝或要求修订，生成者和模型不得自行批准。

#### Scenario: 自动预检全部通过

- **WHEN** 候选通过所有自动预检
- **THEN** 状态 SHALL 进入 awaiting-human-review
- **AND** 不得自动变为 approved 或 path-eligible

#### Scenario: 人工审核批准候选

- **WHEN** 审核者核对题面、答案、干扰项、语义、阶段和来源后批准
- **THEN** 系统 SHALL 记录 reviewer、时间、候选内容哈希、逐项决定和 rationale
- **AND** 后续内容变化 SHALL 使该决定 stale

### Requirement: 生成题发布创建版本化目录回执

只有当前人工批准、预检有效且治理字段完整的候选 MAY 发布。发布 SHALL 创建新的 catalog item/content identity、目录 release 和 publication receipt，并保留候选到已发布题目的 lineage；不得原地改写已有答题快照引用的题目。

#### Scenario: 批准候选发布

- **WHEN** 授权发布者选择一个当前批准候选
- **THEN** exporter SHALL 生成版本化目录记录和可回读 publication receipt
- **AND** 运行时资格 SHALL 继续由目录阶段政策决定

#### Scenario: 已发布内容需要修改

- **WHEN** 已发布题目的题面、答案或语义需要变化
- **THEN** 系统 SHALL 创建新候选修订和新内容身份并重新审核
- **AND** 历史答题快照 SHALL 保持指向旧内容

### Requirement: 候选状态、退役和回滚可审计

候选 SHALL 通过 append-only 状态事件表达 precheck-failed、awaiting-human-review、approved、rejected、published 和 retired。发布回滚 SHALL 停止新选择并保留目录、候选和历史答题 lineage，不得删除或重写历史内容。

#### Scenario: 发布后发现题目缺陷

- **WHEN** 授权审核者确认已发布题目不再可用
- **THEN** 系统 SHALL 发布退役/替代决定并阻止新选择
- **AND** 历史答案和审核事件 SHALL 保持可读

