## MODIFIED Requirements

### Requirement: Planner gates active path nodes by learner readiness
The adaptive path planner SHALL evaluate learner readiness using portrait v2
learner-state signals before placing a ResourceNode into the immediately
executable portion of a generated path. Every formal path node MUST have `pathEligible=true`, a valid current Authority/Projection/binding-release identity, and at least one accessible anchored resource. A node with no resource or an unresolved required binding MUST be excluded or returned as an explicit blocked diagnostic. For each canonical knowledge in the goal slice the planner MUST read the learner's `knowledgeMastery`: when `evidenceCount = 0` or `posteriorMastery < 0.5` only `appearance=first` resources are admissible; when `posteriorMastery >= 0.5` with `evidenceCount > 0` both `first` and `revisit` resources are admissible; when `posteriorMastery >= 0.85` and `confidence >= 0.6` the knowledge SHALL be skipped. Among admissible resources the planner MUST prefer `first` for knowledge the learner has not mastered and MUST order by `teachingOrder` proximity before preference scores. Threshold constants MUST live in one shared module.

#### Scenario: Student lacks readiness for a heavy node
- **WHEN** a student requests a path and the portrait v2 learner-state slice is below a node's readiness threshold
- **THEN** the planner SHALL exclude that node from `activeNodeIds`
- **AND** it SHALL include preparation nodes or fallback nodes before the locked node when such nodes are available
- **AND** it SHALL keep the locked node out of current or next executable actions.

#### Scenario: Node has no accessible resource
- **WHEN** an unmet prerequisite node has no accessible anchored lesson step, handout section, media segment, card, textbook section, or other projected resource
- **THEN** the planner SHALL not emit an executable node
- **AND** it SHALL report the exact readiness blocker

#### Scenario: Optional card is missing
- **WHEN** a node has an accessible handout section/step but no optional card
- **THEN** the node SHALL remain path-eligible
- **AND** the planner SHALL choose the other resource and annotate card absence

#### Scenario: Low-readiness control-correction learner requests a path
- **WHEN** student `20230010102601` or an equivalent learner has low portrait v2 readiness for control modeling/representation and controller design/synthesis
- **THEN** Arena and other terminal heavy nodes SHALL NOT be returned as immediate current nodes
- **AND** the first executable option SHALL start with preparation, knowledge, guided practice, diagnosis, or low-risk resource nodes
- **AND** any values derived from legacy six-dimensional compatibility mapping SHALL be identified in diagnostics.

#### Scenario: New learner meets a knowledge with first and revisit resources
- **WHEN** a learner has no mastery evidence for a goal knowledge that has both `first` (unit 1-3) and `revisit` (unit 4-2) bindings
- **THEN** the planner SHALL mount only `first` resources for that knowledge
- **AND** the path explanation SHALL state that revisit resources unlock after mastery evidence reaches 0.5

#### Scenario: Partially mastered learner
- **WHEN** a learner has `posteriorMastery = 0.62` with evidence for that knowledge
- **THEN** both `first` and `revisit` resources SHALL be admissible
- **AND** `first` SHALL still rank ahead when preference scores tie

#### Scenario: Mastered knowledge
- **WHEN** a learner has `posteriorMastery = 0.9` and `confidence = 0.7` for a goal knowledge
- **THEN** the planner SHALL skip that knowledge in the skeleton and record the skip reason

### Requirement: Path generation snapshots the live published resource index
路径规划开始前 SHALL 读取当前活 `PublishedResourceFeatureIndex`、活动锚点化资源绑定发布与活动 Runtime release，并将本次输入快照随生成结果保存。快照 SHALL 能追溯每个参与规划的已发布资源的 resourceId、绑定 anchor 与 appearance、内容版本或校验值、对象键或 sourcePath、`bindingReleaseId/bindingHash` 以及 Runtime release。索引、活绑定发布或活动 release 不可用时，生成 SHALL 失败关闭，SHALL NOT 静默改用未挂接发布索引的本地默认登记表或课程投影 B′ 的 `bindings.jsonl`。

#### Scenario: Snapshot is recorded before assembly
- **WHEN** 一次候选路径生成开始
- **THEN** 服务端 SHALL 先加载活发布资源索引、活绑定发布与活动 Runtime release
- **AND** 生成结果 SHALL 包含本次 `planningResourceSnapshot`（indexId、projectionId、projectionHash、bindingReleaseId、bindingHash、runtimeReleaseId，以及 recommendable 资源的 resourceId、anchor、appearance 与内容版本/对象键或 sourcePath）
- **AND** 装配与排序 SHALL 消费该快照对应的已发布节点

#### Scenario: Missing published index fails closed
- **WHEN** 活发布资源索引、活绑定发布或活动 Runtime release 无法读取
- **THEN** 生成 SHALL 返回明确失败
- **AND** SHALL NOT 继续用未挂接发布索引的本地候选源或 B′ 绑定产出成功路径
