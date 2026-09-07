## ADDED Requirements

### Requirement: Relation-family shards co-deliver relation endpoints
每一分片交付的关系，其全部端点对象 SHALL 与该关系在同一分片内同交付（bounded closure，对象去重，仅含呈现必需字段）。任何消费层 SHALL NOT 因端点对象缺席而丢弃已交付关系；交付但不达的关系 SHALL 视为分片构建失败并 fail closed。

#### Scenario: Engineering family shard has no dangling edge
- **WHEN** 一个 relation-family 分片交付 N 条工程关系
- **THEN** 这 N 条关系的 2N 个端点 SHALL 全部存在于同一分片或已确立的父级分片（root/domain-default）对象集中
- **AND** 物化 receipt SHALL 记录端点缺席计数为零

#### Scenario: Builder detects an undeliverable endpoint
- **WHEN** 构建期发现某关系的端点对象无法随分片交付（源数据缺席或越界）
- **THEN** 构建 SHALL fail closed 并记录该关系与端点身份
- **AND** SHALL NOT 静默交付悬空边

### Requirement: Shard coverage receipts are computed from the final payload
分片集的覆盖收据（含 `teachingCoverage.relationCount` 及同类计数字段）SHALL 在写盘前从最终序列化 payload 重算，SHALL NOT 从上游覆盖声明（如教材章节 Coverage）或构建期声明值抄录。收据与载荷不一致 SHALL 视为物化失败。

#### Scenario: Receipt matches payload per domain
- **WHEN** 分片集物化完成
- **THEN** 每个域的覆盖收据计数 SHALL 等于该域最终分片 payload 中的实际关系/对象计数
- **AND** 不一致时物化 SHALL fail closed
