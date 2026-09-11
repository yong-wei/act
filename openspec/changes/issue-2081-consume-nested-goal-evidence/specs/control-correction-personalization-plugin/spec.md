# Delta: control-correction-personalization-plugin

## ADDED Requirements

### Requirement: Plugin consumes nested formal-assessment goal evidence
控制校正插件 SHALL 将正式自适应测评写入的嵌套学习目标集合（`contextJson.adaptiveAssessment.kaqQuizEvidence.learningGoalIds`）作为控制校正证据归属来源；数据库查询与内存匹配 SHALL 使用同一套目标归属规则，且 SHALL NOT 放宽对无学习目标、未审核、版本不一致或目标不匹配事实的拒绝。

#### Scenario: Nested goal facts enter the control-correction slice
- **WHEN** 合格正式测评事实的嵌套 `learningGoalIds` 包含控制校正目标且通过治理合格性过滤
- **THEN** 插件 SHALL 将其归入对应学习目标的控制校正证据切片
- **AND** 画像维度与能力目标 SHALL 出现非零直接证据与可追溯的学生安全证据引用

#### Scenario: Database query and in-memory matching agree
- **WHEN** 同一批 LearningFact 分别经数据库 where 查询与内存匹配判定控制校正归属
- **THEN** 两条路径 SHALL 返回一致的目标归属结果

#### Scenario: Ineligible facts stay rejected
- **WHEN** 事实无学习目标、未通过审核、知识版本不一致或目标与控制校正不匹配
- **THEN** 插件 SHALL 维持拒绝，SHALL NOT 因嵌套路径存在而放宽归属
