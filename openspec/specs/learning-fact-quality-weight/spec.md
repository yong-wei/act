# learning-fact-quality-weight Specification

## Purpose
Define how evidence quality controls LearningFact contribution to competency profiles while preserving traceability for low-quality or incomplete evidence.
## Requirements
### Requirement: Profile contribution follows evidence quality
The system SHALL weight or suppress competency contribution according to complete, explicit evidence governance.

#### Scenario: Legacy submit does not advance profile score
- **WHEN** a lesson_submit fact is materialized from legacy or missing evidence
- **THEN** the fact remains traceable but does not contribute as profile-grade competency evidence

#### Scenario: Partial submit is downgraded
- **WHEN** a lesson_submit fact is materialized from partial evidence
- **THEN** the fact carries a reduced profile weight and the context records the policy reason

#### Scenario: Unmanaged fact is context-only
- **WHEN** a LearningFact lacks a finite `profileWeight`, boolean `skipProfileContribution`, or policy reason in its evidence governance
- **THEN** the system SHALL assign zero profile weight
- **AND** it SHALL not contribute to competency or portrait projections

#### Scenario: Materialized unknown source is auditable
- **WHEN** a materialized learning event has no source-specific profile policy
- **THEN** its LearningFact SHALL record an explicit context-only governance policy
- **AND** it SHALL retain the event as traceable context

### Requirement: Rich objective evidence remains profile-grade
The system SHALL preserve rich objective submission contribution when submitted answers and scoring context are available.

#### Scenario: Rich objective fact is weighted normally
- **WHEN** a manifest-submission-v2 objective payload contains score and question summaries
- **THEN** the materialized fact keeps profile-grade contribution and records rich evidence quality

#### Scenario: Approved direct producer declares its contribution
- **WHEN** teacher-reviewed document grading or official Arena evidence writes a LearningFact intended for profile use
- **THEN** the producer SHALL persist explicit profile weight, skip flag, and policy reason

### Requirement: 微干预事件按验证权威分配质量权重

LearningFact 质量政策 SHALL 将微干预资源打开、学习动作、提示和完成事件标记为 context-only、零 profile weight；治理合格的独立验证结果 MAY 获得有界 assessment-backed 权重。权重政策 MUST 记录算法版本、原因、重复抑制和终结性掌握限制。

#### Scenario: 参与事件物化为 LearningFact

- **WHEN** 微干预参与事件需要保留为可追踪上下文
- **THEN** LearningFact SHALL 设置零 profile weight 和显式 policy reason
- **AND** 不得参与 competency/profile 得分

#### Scenario: 独立验证结果物化

- **WHEN** 合格微干预验证投影创建 LearningFact
- **THEN** producer SHALL 持久化有界 profile weight、skip flag、policy reason 和证据算法版本
- **AND** 单条事实不得被标记为 terminal-mastery-grade
