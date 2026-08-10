## ADDED Requirements

### Requirement: Generation progress exposes teaching stage and action state
The smart-preparation UI SHALL present the teaching stages `提纲`, `导入`, `学习目标`, `前测`, `参与式学习`, `后测`, and `总结`, each with one current action state from `等待开始`, `正在准备依据`, `正在生成`, `正在校验`, `正在自动修正`, `等待教师确认`, `可重试`, `已完成`, and `已取消`.

#### Scenario: A stage is running
- **WHEN** a generation stage is active
- **THEN** its row SHALL show the teaching-stage name, current action state, and a visible motion cue
- **AND** the interface SHALL NOT rely on animation alone to communicate progress.

#### Scenario: Provider or validation work changes state
- **WHEN** the job moves between generation, validation, and automatic correction
- **THEN** the current action label SHALL update without a manual page refresh.

### Requirement: Completed stages appear immediately as rendered content
The workspace SHALL refresh active durable jobs and expose each schema-valid persisted stage as soon as it completes.

#### Scenario: A stage completes
- **WHEN** normalized stage content passes structure, source, and duration validation and is persisted
- **THEN** the stage SHALL receive a completion mark and render its complete teaching content
- **AND** later stages MAY continue running without hiding the completed result.

#### Scenario: Stage output is not valid
- **WHEN** provider output has not passed validation
- **THEN** it SHALL remain in generation, validation, or correction state
- **AND** raw JSON or a partial structured object SHALL NOT be shown as completed teaching content.

### Requirement: Failed generation resumes from the first incomplete stage
The generation service SHALL preserve completed stages and SHALL resume only from the first incomplete stage after retry, cancellation, navigation, or process restart.

#### Scenario: A provider attempt fails after earlier stages complete
- **WHEN** the current stage enters a retryable failure
- **THEN** earlier completed stages SHALL remain visible and immutable for that attempt
- **AND** the teacher SHALL receive a Chinese failure reason and retry action for the failed stage.

#### Scenario: Teacher requests retry
- **WHEN** the teacher explicitly retries a retryable stage
- **THEN** the system SHALL create a new provider attempt and idempotency key for that stage
- **AND** it SHALL NOT regenerate completed stages.

#### Scenario: The same queue delivery is repeated
- **WHEN** the worker receives a duplicate delivery for one attempt identity
- **THEN** the delivery SHALL converge on the existing stage result
- **AND** it SHALL NOT create another provider charge or duplicate output.

### Requirement: Existing generation jobs migrate to localized projections
Existing readable generation jobs SHALL map to the new stage and action-state presentation without losing recovery.

#### Scenario: Historical job is terminal
- **WHEN** an existing job is completed, failed, or cancelled
- **THEN** the workspace SHALL derive the corresponding Chinese terminal state and render any valid completed stages.

#### Scenario: Historical failure code is unknown
- **WHEN** an existing job has an unsupported failure payload
- **THEN** the workspace SHALL show a general actionable failure state
- **AND** it SHALL NOT expose the provider payload or stack trace to the teacher.
