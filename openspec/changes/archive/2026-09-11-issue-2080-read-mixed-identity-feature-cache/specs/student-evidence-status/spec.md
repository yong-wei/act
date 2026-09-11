# Delta: student-evidence-status

## ADDED Requirements

### Requirement: Profile surfaces mixed knowledge identity
画像证据状态面 SHALL 保留并展示 `mixed-knowledge-identity` 标记与分版本可比性限制，SHALL NOT 将混合身份证据伪装成单一知识版本。

#### Scenario: Mixed-identity portrait keeps risk markers
- **WHEN** 学生特征缓存携带合法 `mixed-knowledge-identity` 标记
- **THEN** 画像读取 SHALL 保留该标记并呈现混合身份与跨版本不可直接比较的限制
- **AND** 画像置信状态 SHALL NOT 仅因该标记被判为 `stale`
