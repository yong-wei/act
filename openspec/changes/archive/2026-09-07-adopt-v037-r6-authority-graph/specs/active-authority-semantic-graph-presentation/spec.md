## ADDED Requirements

### Requirement: Engineering prerequisite relations are a first-class presentable family
上游工程图谱发布的 `prerequisite` 谓词（DomainConcept–DomainConcept、有向、无环）SHALL 作为一等工程关系族（先后修）进入分片族映射、谓词支持集与画布过滤器，SHALL NOT 仅存在于 node-neighborhood 分片。该族的呈现 SHALL 保留方向语义。

#### Scenario: User filters the prerequisite family
- **WHEN** 用户在领域内启用「先后修」关系过滤
- **THEN** 画布 SHALL 呈现该域全部已交付 prerequisite 边及其端点
- **AND** 边的方向 SHALL 与上游发布语义一致

### Requirement: Authority nodes expose governed aliases
权威对象的治理别名（上游 alias / alternative 标签）SHALL 进入快照与分片标签数据，可用于检索与辅助显示；别名 SHALL 服从与首选名相同的 locale 资格与呈现安全判据，SHALL NOT 以未经资格认定的语言回填。

#### Scenario: Search matches a governed alias
- **WHEN** 用户以某对象的治理别名检索
- **THEN** 该对象 SHALL 命中
- **AND** 显示名仍为当前 locale 的首选标签

#### Scenario: Alias lacks qualified locale form
- **WHEN** 某别名在当前 locale 无资格认定形式
- **THEN** 该别名 SHALL NOT 在该 locale 呈现
- **AND** zh-CN 基底行为不变
