# personalized-path-decision-evidence Specification

## Purpose
个性化路径在生成时冻结只读决策证据链，使候选解释绑定当时的画像事实和路径差异，而不被后续画像刷新改写。
## Requirements
### Requirement: Path generation freezes a read-only decision snapshot

路径生成 SHALL 保存只读决策快照。快照 MUST 绑定画像版本、候选批次和规划器版本。后续画像刷新 MUST NOT 改写已保存解释。

#### Scenario: A batch is generated from current learner evidence

- **WHEN** 服务端生成候选路径批次
- **THEN** 快照包含薄弱点、掌握度或能力状态、资源偏好及置信度、证据窗/新鲜度/来源覆盖、缺失证据和降级原因
- **AND** 只读查看或刷新页面 MUST 返回同一快照

### Requirement: Each candidate records profile-driven impacts

每个候选路径 SHALL 记录相对同批次其他路径的实际影响，并区分画像因素与通用规则。

#### Scenario: A well-evidenced profile fact changes a path

- **WHEN** 充分证据的薄弱点或可信资源偏好影响候选
- **THEN** 该候选记录加入、删除或提前的节点，或资源类型选择依据
- **AND** 未采用的偏好 SHALL 给出明确原因
- **AND** 解释不得称为最佳路径或系统排名

### Requirement: Insufficient evidence is shown as degraded

证据低置信、过期、缺失或不完整时，系统 SHALL 显示依据不足，不得伪造个性化结论。

#### Scenario: Preference evidence is missing

- **WHEN** 资源偏好证据不足或过期
- **THEN** 解释说明暂时无法判断资源偏好
- **AND** MUST NOT 把通用规则路径表述为个性化推荐

