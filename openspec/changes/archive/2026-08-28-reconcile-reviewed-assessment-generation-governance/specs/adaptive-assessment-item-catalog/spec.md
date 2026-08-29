## ADDED Requirements

### Requirement: 目录治理身份与生成审核对账保持一致

`adaptive-assessment-item-catalog` SHALL 使用已对账的生成审核合同、候选 lineage 和 publication receipt identity。目录构建不得从 `ai_generated`、进程内对象或客户端来源字段推断生成资格。

#### Scenario: 目录读取合格生成发布物

- **WHEN** catalog builder 读取与当前 reconciliation receipt、人工批准和 publication receipt 一致的候选
- **THEN** 它 SHALL 登记同一 candidate revision、content hash、generation kind 和 publication identity
- **AND** 该项目 MAY 再按现有 stage policy 参与 path eligibility 计算。

#### Scenario: 目录遇到模板 Map 或漂移候选

- **WHEN** 候选只有模板运行缓存、旧 `ai_generated` 标签、缺失 lineage 或与对账 revision 不一致
- **THEN** catalog SHALL 报告 blocked/provisional 或排除该对象
- **AND** 不得创建第二个 candidate identity 来绕过缺口。
