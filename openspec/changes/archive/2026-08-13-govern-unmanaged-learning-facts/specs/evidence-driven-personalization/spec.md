## MODIFIED Requirements

### Requirement: Personalization reads governed evidence
The system SHALL use governed evidence, snapshots, summaries, or student evidence feature cache data, including simulation/Arena-derived features, for core profile and recommendation decisions.

#### Scenario: Recommendation consumer reads governed feature data
- **WHEN** a recommendation or profile consumer needs student learning evidence
- **THEN** it SHALL read governed facts, snapshots, summaries, or evidence feature cache data for core profile computation
- **AND** raw source-table reads SHALL be limited to audit, debug, migration, or drilldown paths

#### Scenario: Unmanaged LearningFact is excluded from personalization
- **WHEN** a LearningFact lacks complete evidence governance
- **THEN** recommendation activity, evidence coverage, feature-cache aggregation, and learner-state preference inputs SHALL exclude it
- **AND** it SHALL not become the basis of a personalized claim

#### 场景：context-only LearningFact 排除在个性化之外
- **当** LearningFact 的证据治理字段完整，但解析后画像权重为零或显式跳过画像贡献
- **那么** 推荐活动、证据覆盖、最近活动、连续学习、feature cache 聚合和学习者状态偏好输入均不得包含该事实
- **并且** 该事实仅可供审计或时间线下钻读取者使用

#### 场景：context-only LearningFact 不得截断合格事实
- **当** 个性化读取路径需要在合格 LearningFact 数量上施加上限，且最新原始记录中包含 context-only 事实
- **那么** 读取路径必须持续分页至获得所需合格事实或数据耗尽
- **并且** context-only 事实不得遮蔽最近活动、连续学习、证据覆盖或学习者状态偏好所需的合格事实

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine

#### Scenario: Simulation features contribute to weak-area rationale
- **WHEN** simulation or Arena-derived feature cache data identifies weak metrics, repeated constraint failures, low replay confidence, or incomplete evidence
- **THEN** personalization output SHALL be able to reference those governed features as rationale with source coverage and confidence metadata
