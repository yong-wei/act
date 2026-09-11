# Delta: student-evidence-feature-cache

## ADDED Requirements

### Requirement: Mixed knowledge identity is a readable diagnostic marker
合法 `mixed-knowledge-identity` 状态标记 SHALL 被视为可读的跨版本可比性诊断，SHALL NOT 单独导致缓存结构校验失败或 `readState=stale`；缓存读取 SHALL 完整保留该标记与 `knowledgeIdentityCoverage`/`mergedAggregateComparability` 风险标注。

#### Scenario: Mixed-identity cache round-trips as ready
- **WHEN** 学生合格证据跨越多个知识命名空间或 revision，特征缓存写入后再经治理读取边界读取
- **THEN** 读取结果 SHALL 为 `ready`（在未真实过期且结构完整时）
- **AND** `confidence.markers` SHALL 保留 `mixed-knowledge-identity`，且 `singleVersionComparable=false` 的可比性标注 SHALL 随载荷保留

#### Scenario: Unknown marker values stay fail-closed
- **WHEN** 缓存载荷的状态标记包含未定义语义的未知值
- **THEN** 读取 SHALL 判定结构失效并返回 `stale`
- **AND** SHALL NOT 静默丢弃未知标记后继续返回 `ready`

#### Scenario: Genuinely expired or corrupted caches stay stale
- **WHEN** 缓存超过新鲜度窗口、schema 版本不匹配或载荷结构损坏
- **THEN** 读取 SHALL 返回对应的 `stale` 受限状态
- **AND** 本变更 SHALL NOT 改变这些既有失败路径的判定
