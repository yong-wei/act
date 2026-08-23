# learning-evidence-source-catalog Specification

## Purpose
Define the governed learning evidence source catalog and read-only coverage report used to classify source provenance, learning scope, evidence value, profile eligibility, and materialization readiness before profile or recommendation consumers rely on those sources.
## Requirements
### Requirement: Governed evidence source catalog
The system SHALL maintain a machine-readable catalog of learning evidence sources that identifies each source table or event family, its provenance policy, learning scope, value level, profile eligibility, and materialization readiness.

#### Scenario: Catalog covers known evidence families
- **WHEN** the evidence catalog is generated or inspected
- **THEN** it SHALL include entries for `InteractionLog`, `StudentStepResponse`, `SimulationLog`, `UserAnswer`, `AbilityAssessment`, `PromptAssessment`, `DesignSession`, `ArenaSubmission`, `ArenaEvaluationRun`, and `LearningFact`
- **AND** each entry SHALL state whether the source is classroom-bound, standalone, out-of-class, historical, or mixed.

#### Scenario: Provenance policy is explicit
- **WHEN** a source or row family originates from seed, showcase, demo, or test data
- **THEN** the catalog SHALL mark it as not eligible for real student profile contribution by default
- **AND** rows with unknown provenance SHALL be reported separately from confirmed real activity.

#### Scenario: Value level controls profile eligibility
- **WHEN** a source event is a passive page view, navigation event, leaderboard view, or similar low-value interaction
- **THEN** the catalog SHALL classify it as activity context
- **AND** it SHALL NOT directly contribute to competency scores unless a future spec explicitly upgrades that event family.

### Requirement: Coverage report is read-only and reproducible
The system SHALL provide a dry-run evidence coverage report that summarizes current source coverage, eligibility, exclusions, users, and source windows without mutating data.

#### Scenario: Coverage report does not write data
- **WHEN** the coverage report command is run
- **THEN** it SHALL read source tables and emit source coverage metrics
- **AND** it SHALL NOT create, update, or delete `LearningFact`, snapshot, summary, feature, or raw source rows.

#### Scenario: Coverage report explains exclusions
- **WHEN** a source row family is excluded from profile eligibility
- **THEN** the report SHALL include the exclusion reason, source family, row count, affected user count when available, and sample source reference when safe.

#### Scenario: Coverage report includes source windows
- **WHEN** a source family contains timestamped rows
- **THEN** the report SHALL include first and last observed timestamps for that source family
- **AND** it SHALL include affected user counts where the source has a user identifier.

### Requirement: Interaction logs resolve canonical event types
The system SHALL use canonical event type resolution when classifying `InteractionLog` rows for governance coverage.

#### Scenario: Payload event type takes precedence
- **WHEN** an `InteractionLog` row contains `eventData.eventType`
- **THEN** governance catalog and coverage logic SHALL use that value as the canonical event type
- **AND** the top-level `eventType` SHALL remain available as the wrapper or legacy type.

#### Scenario: Wrapper type fallback
- **WHEN** an `InteractionLog` row does not contain a valid `eventData.eventType`
- **THEN** governance catalog and coverage logic SHALL fall back to the top-level `eventType`
- **AND** it SHALL report that the row lacks canonical payload typing when this affects classification.

### Requirement: 来源目录声明仿真任务证据资格
学习证据来源目录 SHALL 为虚拟仿真、控制工作台、Arena 和奥德赛声明可形成任务证据的产品语义事件，并明确浏览、结果查看和孤立参数调整等不可计入事件。

#### Scenario: 白名单事件被来源目录识别
- **WHEN** 证据物化服务检查仿真来源事件
- **THEN** 系统仅接受目录声明的完成运行、持久化设计、评估、提交、关卡结果或得分事件
- **AND** 孤立参数调整只能附着到后续持久化产物，不能单独成为任务证据

#### Scenario: 非学习产物被拒绝
- **WHEN** 来源事件仅表示界面浏览、打开面板、结果查看或完全相同的重放
- **THEN** 系统将其标为不具备任务证据资格
- **AND** 不为它创建任务级学习事实贡献

### Requirement: Prompt assessment records remain context-only until separately governed
The governed evidence source catalog SHALL classify `PromptAssessment` quality and consistency records as learner-owned learning-process context by default. The source SHALL remain traceable but SHALL NOT be profile eligible unless a later specification declares source-specific quality governance and materialization rules.

#### Scenario: Prompt assessment is inspected by evidence governance
- **WHEN** the evidence source catalog or coverage report inspects `PromptAssessment`
- **THEN** it SHALL identify the record as student-owned prompt-evaluation process evidence
- **AND** it SHALL report the source as not profile eligible by default

