# student-evidence-status Specification

## Purpose
Define the learner-facing evidence status surface used by student profiles and recommendation cards so missing, stale, or low-confidence governed evidence is visible instead of being presented as precise diagnosis.
## Requirements
### Requirement: Student profile exposes evidence status
The student profile API SHALL include governed evidence status from feature cache and facts.

#### Scenario: Missing cache is explicit
- **WHEN** a student has no feature cache entry
- **THEN** the profile response marks evidence status missing and avoids precise high-confidence explanations

### Requirement: Recommendation rationale keeps evidence metadata
Student-facing recommendation outputs SHALL preserve evidence basis, window, count, source coverage, and confidence metadata.

#### Scenario: Low-confidence recommendation is labeled
- **WHEN** a recommendation is produced from stale or partial evidence
- **THEN** the response exposes low-confidence metadata for the UI

### Requirement: Profile surfaces mixed knowledge identity
画像证据状态面 SHALL 保留并展示 `mixed-knowledge-identity` 标记与分版本可比性限制，SHALL NOT 将混合身份证据伪装成单一知识版本。

#### Scenario: Mixed-identity portrait keeps risk markers
- **WHEN** 学生特征缓存携带合法 `mixed-knowledge-identity` 标记
- **THEN** 画像读取 SHALL 保留该标记并呈现混合身份与跨版本不可直接比较的限制
- **AND** 画像置信状态 SHALL NOT 仅因该标记被判为 `stale`

### Requirement: Profile exposes identity-grouped evidence statistics
画像 API 与学生端状态面 SHALL 展示按知识身份分组的证据统计，并明确呈现混合版本限制；混合身份证据 SHALL NOT 被呈现为单一知识版本。

#### Scenario: Mixed-version limitation is visible
- **WHEN** 学生证据跨越多个知识命名空间或 revision
- **THEN** 画像响应 SHALL 包含按知识身份分组的统计与 `singleVersionComparable=false` 的限制说明
- **AND** 学生端 SHALL 呈现该限制而非高置信度单一版本结论

#### Scenario: Isolated facts are accounted
- **WHEN** 部分事实因无法确定身份被隔离为零权重上下文
- **THEN** 画像统计 SHALL 说明该类事实的数量与受限状态
- **AND** SHALL NOT 将其计入高置信度证据

