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

