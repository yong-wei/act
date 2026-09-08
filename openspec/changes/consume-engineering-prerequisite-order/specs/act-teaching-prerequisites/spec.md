## ADDED Requirements

### Requirement: Engineering learning order retains independent provenance
Engineering Authority 的已发布、直接 `prerequisite` SHALL 保留工程来源、原始关系身份、方向及 snapshot 身份，供路径规划在相同 snapshot 的教学资源绑定上直接消费。消费工程顺序 SHALL NOT 伪造 ACT_TEACHING 发布或人工审核；既有教学关系 SHALL 保留其强度和来源。

#### Scenario: Published engineering dependency is consumed
- **WHEN** 工程 Authority 与教学资源绑定属于同一已验证 snapshot
- **THEN** 明确的直接 prerequisite SHALL 可以作为知识依赖输入
- **AND** 工程关系 SHALL 保持原始来源，不改写为 ACT_TEACHING REQUIRED

#### Scenario: Other engineering relationships exist
- **WHEN** 关系为 association、derived_from、has_component 等非 prerequisite 谓词
- **THEN** 规划 SHALL NOT 将其推断为必需先修

#### Scenario: Snapshot identities differ
- **WHEN** 工程关系与教学绑定的 snapshot ID 或 hash 不一致
- **THEN** 规划 SHALL 显式报告输入不可组合，不生成伪造的共同图谱
