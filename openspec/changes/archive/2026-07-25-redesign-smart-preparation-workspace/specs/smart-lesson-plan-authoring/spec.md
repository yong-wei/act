## ADDED Requirements

### Requirement: Smart preparation presents one staged task workspace
The system SHALL present smart preparation through the top-level views `备课任务` and `课程依据`, and SHALL render one selected task as the ordered accordion stages `课程依据`, `主题与目标`, `班级学情`, `生成与审核教案`, and `生成课件`.

#### Scenario: Teacher opens an existing task
- **WHEN** an authorized teacher selects a task
- **THEN** the workspace SHALL show the five stages in order
- **AND** each stage SHALL be collapsible without discarding persisted values or active generation state.

#### Scenario: Teacher surveys task progress
- **WHEN** one or more stages contain saved data
- **THEN** the workspace SHALL show each stage's Chinese status, completion mark, blocking reason when present, and next available action
- **AND** the teacher SHALL be able to expand completed and incomplete stages independently.

#### Scenario: Course-basis state changes in the management view
- **WHEN** the teacher creates, edits, freezes, disables, or deletes a course-basis document and returns to the current task
- **THEN** the task's source choices, state labels, and previews SHALL reflect the persisted change without a full page refresh
- **AND** the current task, expanded stage, and scroll position SHALL be preserved when still valid.

### Requirement: Stage completion is derived from valid persisted facts
The system SHALL mark a preparation stage complete only when its required data is persisted and valid and every explicit teacher confirmation required by that stage is present.

#### Scenario: A stage becomes valid
- **WHEN** all required fields, source decisions, and teacher confirmations for a stage are saved
- **THEN** the stage SHALL receive a completion check automatically.

#### Scenario: A completed stage is invalidated
- **WHEN** a teacher edit makes a required field, source binding, confirmation, or downstream baseline stale
- **THEN** the affected stage SHALL lose its completion check
- **AND** later affected stages SHALL show the specific stale or blocked state without deleting their prior content.

### Requirement: Preparation tasks have reference-aware deletion and archive
The system SHALL permit the owning teacher to permanently delete a task until it is formally published or referenced by a classroom runtime, regardless of whether generation or approval has completed.

#### Scenario: Unpublished task is deleted
- **WHEN** the teacher confirms deletion of a task with no publication or classroom reference
- **THEN** the task, provider attempts, outlines, generation stages, lesson drafts, approved but unpublished lesson revisions, and task-owned unpublished courseware SHALL be permanently deleted atomically
- **AND** the task SHALL disappear from the task list.

#### Scenario: Referenced task deletion is requested
- **WHEN** the teacher requests deletion of a task referenced by a publication or classroom runtime
- **THEN** the system SHALL refuse permanent deletion
- **AND** it SHALL identify the blocking reference category, explain that the task can only be archived, and provide the relevant management action.

#### Scenario: Task is archived
- **WHEN** the teacher archives a task
- **THEN** it SHALL leave the default active list while remaining available through the archived-task filter.

### Requirement: Existing smart-preparation tasks remain usable
The system SHALL project existing readable tasks and jobs into the staged workspace without exposing raw JSON.

#### Scenario: Existing structured output is valid
- **WHEN** an existing task contains schema-valid outline, stage, draft, or revision content
- **THEN** the content SHALL render in its corresponding accordion stage using the normal teaching-document presentation.

#### Scenario: Existing job can resume
- **WHEN** an existing task has a persisted retryable or cancelled job
- **THEN** the workspace SHALL show the completed stages and the resume action at the first incomplete stage.

#### Scenario: Existing payload cannot be rendered
- **WHEN** an existing payload is not compatible with the supported schema
- **THEN** the workspace SHALL show an actionable Chinese unavailable state
- **AND** it SHALL NOT display the serialized payload as teacher-facing content.
