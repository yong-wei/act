## ADDED Requirements

### Requirement: Path generation consumes the authoritative learner-state snapshot
新建学习路径时，系统 SHALL 直接读取现有权威学习者状态服务，并在规划开始时固定学习者状态版本、证据窗口、置信度和新鲜度作为本次规划快照；系统 MUST NOT 从个人中心页面抓取或复制展示数据。

#### Scenario: New path uses the learner profile state
- **WHEN** a student starts a new path for a registered learning goal
- **THEN** the planner SHALL read the authorized learner-state slice for that goal
- **AND** the generated path SHALL retain a reference to the state snapshot used for planning

#### Scenario: Existing path is resumed
- **WHEN** a student chooses to continue an existing path
- **THEN** the system SHALL restore the persisted path and its original planning snapshot
- **AND** it SHALL NOT regenerate the path from the latest learner state

### Requirement: Learner-state fields produce explainable path decisions
路径规划 SHALL 使用已有学习者状态事实影响路径重点、难度、资源组合、节奏或检查点，并为每项个性化调整保留对应证据引用和限制说明。

#### Scenario: Profile evidence changes a new path
- **WHEN** learner-state evidence identifies a weak knowledge area or a resource preference
- **THEN** the new path SHALL reflect that evidence in at least one applicable planning dimension
- **AND** the explanation SHALL identify the evidence category and its confidence limitation

#### Scenario: No applicable evidence exists
- **WHEN** the learner-state slice is missing, stale, or insufficient for a planning dimension
- **THEN** the planner SHALL use a documented starter or fallback rule for that dimension
- **AND** it SHALL NOT claim a personalized adjustment that has no supporting evidence

### Requirement: Path planning exposes a student-safe personalization explanation
路径规划结果 SHALL 同时保留可审计的机器元数据和用户可理解的中文说明；学生可见说明 MUST NOT 暴露内部服务字段、批次标识、提示词或模型术语。

#### Scenario: Student views why a path was generated
- **WHEN** a student opens a newly generated path summary
- **THEN** the page SHALL show the relevant adjustment and its plain-language reason
- **AND** missing or low-confidence evidence SHALL be shown as a limitation
