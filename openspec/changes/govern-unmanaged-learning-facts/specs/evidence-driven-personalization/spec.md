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

#### Scenario: Existing scope is preserved
- **WHEN** personalization consumers are upgraded to governed evidence
- **THEN** the change SHALL preserve the existing recommendation scope and competency model
- **AND** it SHALL NOT introduce a new AI recommendation engine
