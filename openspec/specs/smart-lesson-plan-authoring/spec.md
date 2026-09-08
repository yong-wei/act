# smart-lesson-plan-authoring Specification

## Purpose
TBD - created by archiving change add-smart-lesson-plan-authoring. Update Purpose after archive.
## Requirements
### Requirement: Smart preparation authors one lesson at a time
The system SHALL create each smart-preparation task for one lesson with one confirmed duration, selected course-basis versions, knowledge points, goals, and optional class context.

#### Scenario: Teacher creates a standard-duration task
- **WHEN** a teacher selects 45 or 90 minutes and creates a task
- **THEN** the task SHALL record that exact total duration
- **AND** generated BOPPPS stage and courseware-step time allocations SHALL sum to it.

#### Scenario: Teacher creates a custom-duration task
- **WHEN** a teacher enters a custom duration
- **THEN** the value SHALL be accepted only from 30 through 120 minutes in five-minute increments
- **AND** an invalid duration SHALL be rejected before generation.

#### Scenario: Teacher requests a whole-course batch
- **WHEN** an authoring request attempts to generate multiple lessons, a semester plan, or an automatic schedule in one task
- **THEN** the system SHALL reject it as outside the single-lesson task contract.

### Requirement: Smart preparation supports natural-language multi-turn task refinement
The smart-preparation workspace SHALL let an authorized teacher create and revise the same structured single-lesson task through the existing Konling session API and teacher `prep-coauthor` mode.

#### Scenario: Teacher starts a task in natural language
- **WHEN** a teacher describes the course, lesson topic, duration, audience, knowledge points, or goals in a Konling smart-preparation conversation
- **THEN** the system SHALL project supported decisions into a draft `SmartLessonTask` with links to the responsible conversation turn
- **AND** the structured task SHALL remain the source of truth rather than the raw transcript.

#### Scenario: Required information is ambiguous
- **WHEN** the conversation contains missing, conflicting, or multiply matched course basis, duration, audience, knowledge point, or goal information
- **THEN** Konling SHALL ask a specific clarification question and preserve the unresolved alternatives
- **AND** generation SHALL NOT begin by silently selecting an alternative.

#### Scenario: Teacher refines constraints across turns
- **WHEN** a teacher changes a prior constraint in a later turn
- **THEN** the system SHALL show the proposed structured diff against the current task and apply it only after explicit teacher confirmation
- **AND** the accepted task history SHALL retain the superseded decision, confirming turn, actor, and time.

#### Scenario: Conversation and structured controls are mixed
- **WHEN** the teacher alternates between chat and structured form controls
- **THEN** both surfaces SHALL read and update the same authorized task revision
- **AND** stale conversation output SHALL fail optimistic concurrency rather than overwrite newer structured edits.

### Requirement: Knowledge points are teacher-controlled
The system SHALL let the teacher select, edit, merge, or manually create knowledge points before goal confirmation.

#### Scenario: System suggests knowledge points
- **WHEN** enabled usable course-basis versions or teacher-confirmed textbook ranges are available
- **THEN** the system MAY propose knowledge-point candidates from governed retrieval
- **AND** each candidate SHALL retain source bindings or an explicit source-gap state.

#### Scenario: Teacher edits suggested knowledge points
- **WHEN** a teacher selects, renames, or merges suggested candidates
- **THEN** the task SHALL record the resulting teacher-confirmed knowledge points and their lineage
- **AND** generation SHALL use the confirmed result rather than the original suggestions.

#### Scenario: Teacher creates a knowledge point manually
- **WHEN** a teacher enters a knowledge point that was not suggested
- **THEN** the system SHALL retain it as teacher-created
- **AND** it SHALL automatically attempt source matching before requiring teacher resolution of ambiguity or an explicit source gap.

### Requirement: Teaching goals require confirmation and source mapping
The system SHALL support teacher-entered and system-suggested teaching goals, and SHALL require teacher confirmation before full lesson-plan generation.

#### Scenario: Goals are suggested
- **WHEN** a teacher requests goal suggestions
- **THEN** the system SHALL use the selected standards, textbooks, audience, duration, and confirmed knowledge points
- **AND** every suggested goal SHALL show its standards/textbook source bindings or source-gap state.

#### Scenario: Teacher confirms goals
- **WHEN** a teacher confirms the final goal set
- **THEN** the task SHALL freeze that goal set for the current generation attempt
- **AND** subsequent class adaptation or model output SHALL NOT replace or silently broaden it.

#### Scenario: Full generation starts without confirmed goals
- **WHEN** a request attempts to generate the full lesson plan without confirmed goals
- **THEN** the system SHALL reject the request with a goal-confirmation requirement.

### Requirement: Optional class context uses aggregate governed evidence only
The system SHALL permit a selected class to influence lesson emphasis, difficulty, pacing, and activities only through governed aggregate diagnosis.

#### Scenario: No class is selected
- **WHEN** the task has no class context
- **THEN** generation SHALL produce a generic lesson for the confirmed audience and prerequisites
- **AND** missing class context SHALL NOT be treated as an error.

#### Scenario: A class is selected
- **WHEN** the teacher selects an authorized class with governed aggregate diagnosis
- **THEN** the prompt context SHALL include only aggregate or redacted diagnosis fields and stable authorized references
- **AND** class adaptation SHALL remain subordinate to confirmed knowledge points and goals.

#### Scenario: Raw learner evidence is available
- **WHEN** raw answer bodies, private learner memory, or high-frequency traces are present upstream
- **THEN** the smart-preparation context builder SHALL exclude them
- **AND** their absence from the prompt SHALL be testable through a privacy projection fixture.

### Requirement: Lesson plans use a complete BOPPPS text contract
The system SHALL generate a complete text lesson-plan draft with all six BOPPPS stages and the fields required for teacher review.

#### Scenario: Lesson-plan draft completes
- **WHEN** all generation stages finish successfully
- **THEN** the draft SHALL include course, topic, audience, duration, prerequisites, confirmed goals and standards mapping, knowledge points, key and difficult content, all six BOPPPS stages, sources, limitations, optional class adaptation, and a linked courseware-step outline
- **AND** every BOPPPS stage SHALL include time, teacher activity, student activity, and assessment design.

#### Scenario: Stage durations are validated
- **WHEN** a complete or edited lesson-plan draft is checked
- **THEN** its six stage durations and all nested step durations SHALL sum exactly to the task duration
- **AND** missing, negative, or inconsistent durations SHALL fail deterministic validation.

### Requirement: Lesson-plan generation is staged and optionally pauses for outline review
The system SHALL first create an internal outline and then generate BOPPPS stages progressively, with outline confirmation disabled by default.

#### Scenario: Default generation is started
- **WHEN** the teacher starts generation without selecting outline confirmation
- **THEN** the job SHALL generate the outline and continue directly into ordered BOPPPS stage generation
- **AND** the teacher SHALL NOT be forced to confirm the outline.

#### Scenario: Outline confirmation is selected
- **WHEN** the teacher starts generation with outline confirmation enabled
- **THEN** the job SHALL pause after persisting the outline
- **AND** stage generation SHALL begin only after the teacher confirms or edits that outline.

#### Scenario: A stage completes while the job is active
- **WHEN** a BOPPPS stage finishes generation
- **THEN** the preview SHALL expose that stage as read-only progress
- **AND** editing SHALL remain disabled until the job completes, fails, or is cancelled.

### Requirement: Generation jobs are durable, resumable, and idempotent
Lesson-plan generation SHALL run as durable background jobs with one active job per draft and idempotent start, resume, and cancel actions.

#### Scenario: Teacher leaves the workspace
- **WHEN** an active generation job exists and the teacher navigates away
- **THEN** the worker SHALL continue the job
- **AND** reopening the task SHALL restore persisted progress and status.

#### Scenario: Generation fails during a stage
- **WHEN** a provider, schema, or worker failure occurs after earlier stages completed
- **THEN** the system SHALL preserve completed stages and the normalized failure
- **AND** resume SHALL continue from the failed stage without regenerating completed stages.

#### Scenario: Teacher cancels generation
- **WHEN** the teacher cancels an active job
- **THEN** the system SHALL stop stages that have not started, retain completed stages, and enter a cancelled state
- **AND** a later resume SHALL start from the first incomplete stage.

#### Scenario: Start or resume is submitted twice
- **WHEN** identical idempotency keys or duplicated worker deliveries are received
- **THEN** the system SHALL converge on one job/stage result
- **AND** it SHALL NOT duplicate content, provider charges, or attempt audit records.

#### Scenario: Different lesson tasks are submitted
- **WHEN** a teacher or multiple teachers submit different lesson tasks
- **THEN** the system SHALL allow them to queue independently
- **AND** Provider Registry limits and worker concurrency SHALL determine execution order.

### Requirement: Structured generation uses the Provider Registry
Smart lesson-plan generation SHALL use an enabled runtime-supported Provider Registry entry that satisfies the structured-output requirement.

#### Scenario: A capable provider is available
- **WHEN** generation requests a provider
- **THEN** the registry SHALL select an administrator-configured model with JSON Schema, tool-call, or equivalent normalized structured-output capability
- **AND** the teacher SHALL NOT choose the provider or supply an API key.

#### Scenario: No capable provider is available
- **WHEN** no enabled runtime-supported provider satisfies the generation contract
- **THEN** the job SHALL enter an explicit unavailable or retryable state
- **AND** it SHALL NOT fabricate a lesson plan or silently use the deterministic test provider.

#### Scenario: Provider attempt is recorded
- **WHEN** a generation attempt starts or finishes
- **THEN** the audit SHALL record service id, provider kind, model, prompt version, schema version, timestamps, normalized response identity, outcome, and token/cost metadata when available
- **AND** student-facing output SHALL NOT expose secret or privileged routing details.

### Requirement: Teacher approval freezes an immutable lesson-plan revision
Teacher approval SHALL be the only mandatory human gate before interactive courseware generation and SHALL create an immutable human-readable lesson-plan revision.

#### Scenario: Teacher approves a valid draft
- **WHEN** the owning teacher approves a lesson-plan draft that passes deterministic checks
- **THEN** the system SHALL freeze the content, sources, limitations, provenance, generation metadata, and content hash as `教案第N版`
- **AND** the next approved revision number SHALL be the prior maximum plus one.

#### Scenario: Approved plan is edited
- **WHEN** a teacher edits content derived from an approved revision
- **THEN** the system SHALL create or update a new mutable draft
- **AND** the prior revision SHALL remain unchanged and teacher-only.

#### Scenario: Courseware generation is requested from a draft
- **WHEN** a request references an unapproved lesson-plan draft
- **THEN** the system SHALL reject courseware generation
- **AND** it SHALL require an immutable approved plan revision baseline.

### Requirement: AI lesson-plan review is optional and advisory
The system SHALL allow the teacher to request an AI review after draft generation without making it an approval or publication gate.

#### Scenario: Teacher requests AI review
- **WHEN** an eligible draft is reviewed by AI
- **THEN** the report SHALL identify goal coverage, source consistency, BOPPPS structure, content-quality findings, and suggestions
- **AND** it SHALL NOT approve the plan, automatically rewrite content, or bypass deterministic validation.

#### Scenario: Teacher skips AI review
- **WHEN** the teacher approves a deterministically valid draft without requesting AI review
- **THEN** approval SHALL remain allowed
- **AND** the absence of an AI review SHALL NOT reduce the revision's publication eligibility.

### Requirement: Goal source gaps remain explicit
Every confirmed goal SHALL use the shared canonical source-state contract `verified`, `ai_generated_source_pending`, or `teacher_created_source_pending`, and any pending state SHALL remain visible through review.

#### Scenario: Goal has verified sources
- **WHEN** citation verification accepts one or more Source Pack items for a goal
- **THEN** the goal SHALL use source state `verified` and retain the server-owned citation ids, source-version ids, anchors, and content hashes
- **AND** model-authored URLs SHALL NOT become verified bindings.

#### Scenario: Goal has no verified source
- **WHEN** no eligible source covers a confirmed goal
- **THEN** the goal SHALL use `ai_generated_source_pending` or `teacher_created_source_pending` according to lineage and display a user-facing pending-source label separately from that machine value
- **AND** ordinary plan approval SHALL NOT relabel it as verified
- **AND** the gap SHALL retain a stable gap id bound to the goal id, goal content hash, canonical source state, source-binding-set hash, and smart-task lineage for later publication acknowledgement.

#### Scenario: Unrelated plan changes preserve a goal gap identity
- **WHEN** an approved plan revision changes fields unrelated to a pending goal while that goal's id, content, canonical source state, source-binding set, and smart-task lineage remain unchanged
- **THEN** the exact goal gap identity SHALL remain stable across the plan revision
- **AND** changing the goal content, source-binding set, canonical source state, or goal deletion and recreation SHALL create a new gap identity.

### Requirement: Smart lesson-plan records remain owner-scoped
Course bases, tasks, jobs, drafts, revisions, AI reviews, source bindings, and audit records SHALL be visible only to the owning teacher and authorized governance administrators.

#### Scenario: Student requests plan-authoring data
- **WHEN** a student requests a lesson-plan draft, answer key, provider audit, source-gap acknowledgement, or AI review
- **THEN** the system SHALL deny access
- **AND** publication of courseware SHALL NOT make teacher-only plan records student-visible.

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

### Requirement: Lesson drafts and outlines open in the unified editor
Smart-preparation outline and lesson-draft editing SHALL use the preparation document editor and SHALL preserve task, draft, and approval identities.

#### Scenario: Teacher edits a paused outline
- **WHEN** generation is paused for outline confirmation and the teacher selects edit
- **THEN** the outline SHALL open in the unified editor
- **AND** saving SHALL update the same paused draft rather than creating an unrelated browser-prompt value.

#### Scenario: Teacher edits a generated lesson
- **WHEN** the teacher edits a generated lesson draft
- **THEN** the complete structured lesson SHALL open in the unified editor
- **AND** approval SHALL operate only on the subsequently saved and validated draft revision.

### Requirement: Knowledge points and goals receive governed source matching
The system SHALL attempt to match every teacher-entered or system-suggested knowledge point and goal to reliable evidence in the current preparation resource pack.

#### Scenario: One reliable match exists
- **WHEN** source matching finds one reliable source
- **THEN** the system SHALL attach that source automatically and SHALL NOT require the teacher to process that item before continuing
- **AND** the teacher SHALL still be able to inspect, replace, or remove the binding.

#### Scenario: Reliable matches are ambiguous
- **WHEN** multiple materially different reliable matches remain
- **THEN** the system SHALL ask the teacher to select or reject the candidates
- **AND** the stage SHALL remain incomplete until the ambiguity is resolved.

#### Scenario: No reliable source exists
- **WHEN** source matching finds no reliable source
- **THEN** the item SHALL remain marked as a source gap
- **AND** the stage SHALL complete only after the teacher explicitly confirms the gap and records a short reason.

#### Scenario: Confirmed source gap is displayed
- **WHEN** the teacher confirms a no-source gap and records a reason
- **THEN** the item SHALL remain displayed as `无可靠来源`
- **AND** it SHALL NOT be represented as verified or as having linked evidence.

#### Scenario: Teacher changes an attached source
- **WHEN** the teacher replaces or removes an automatically or manually attached source
- **THEN** the system SHALL persist the new binding or gap state and re-evaluate the affected stage
- **AND** generation SHALL use only the resulting teacher-visible source decision.

### Requirement: Source matching invalidates only on semantic change
The system SHALL preserve valid source decisions across presentation-only edits and SHALL re-evaluate them after semantic edits.

#### Scenario: Formatting-only edit is saved
- **WHEN** an edit changes only formatting, whitespace, or punctuation without changing normalized meaning
- **THEN** existing source bindings and gap confirmations SHALL remain valid.

#### Scenario: Semantic content is changed
- **WHEN** a knowledge point or goal changes meaning
- **THEN** its existing source decision SHALL become stale and source matching SHALL run again
- **AND** affected stage completion SHALL be removed until the new decision is valid.

### Requirement: Class adaptation reads the current cumulative class portrait
When a class is selected for smart preparation, generation SHALL read the current authorized cumulative class portrait rather than a historical diagnosis snapshot.

#### Scenario: Default class is available
- **WHEN** the teacher opens class selection and has an authorized default class
- **THEN** that class SHALL be selected initially and its current cumulative portrait summary SHALL be displayed
- **AND** the teacher SHALL be able to select another authorized class or choose not to use class learning state.

#### Scenario: Default class has no available cumulative portrait
- **WHEN** the authorized default class is selected but its cumulative portrait is unavailable
- **THEN** the UI SHALL show the governed unavailability reason
- **AND** the teacher SHALL still be able to continue with generic audience context, select another class, or choose not to use class learning state.

#### Scenario: Selected class portrait changes before generation
- **WHEN** generation reads the selected class
- **THEN** it SHALL use the current authoritative cumulative class-portrait projection rather than a historical diagnosis report or task snapshot
- **AND** it SHALL NOT require a frozen class-portrait version.

#### Scenario: The same selected class portrait changes during preparation
- **WHEN** new learner evidence updates the selected class's cumulative portrait while the task remains open
- **THEN** the system SHALL NOT create a task-specific portrait version, show a change warning, or mark existing content stale solely for that update
- **AND** the next generation operation SHALL read the latest available cumulative portrait.

#### Scenario: Class selection changes after content generation
- **WHEN** the teacher changes or removes the selected class after generated content exists
- **THEN** the affected generated content SHALL be retained and marked stale
- **AND** regeneration from the outline SHALL require teacher confirmation.

### Requirement: Konling task proposals update the shared preparation task
Smart-preparation natural-language proposals SHALL apply through the same authorized structured task revision used by the accordion controls.

#### Scenario: Proposal is applied
- **WHEN** an authorized teacher applies a valid in-message proposal
- **THEN** the shared task revision SHALL persist the change and lineage to the conversation turn and tool run
- **AND** both the conversation and accordion SHALL reflect the same resulting task.

#### Scenario: In-message actions are available
- **WHEN** the conversation renderer supports structured proposal cards
- **THEN** the separate `查看控灵建议` surface SHALL be removed
- **AND** no second suggestion store SHALL be required.

### Requirement: Smart-preparation assistant labels are correct and localized
All smart-preparation assistant entry points SHALL display `控灵` and Chinese user-facing action labels.

#### Scenario: Smart-preparation task renders
- **WHEN** the page shows assistant collaboration or revision actions
- **THEN** it SHALL use `控灵` rather than `孔灵`
- **AND** provider, tool, draft, and task state identifiers SHALL not be exposed as untranslated primary labels.

### Requirement: Stage duration mismatches receive targeted automatic correction

BOPPPS 阶段生成的时长类校验失败 SHALL 获得针对性的自动 correction：原始生成 prompt SHALL 声明阶段时长与步骤时长总和的一致性约束；步骤时长总和不一致 SHALL 被规范化为 correction 可处理的错误并携带实际值与目标值；每个阶段 attempt SHALL 保持一次 ORIGINAL + 一次 CORRECTION 的调用上限。

#### Scenario: 原始生成携带时长一致性约束

- **WHEN** worker 构造 BOPPPS 阶段生成请求
- **THEN** system prompt SHALL 明确要求 `stage.minutes` 严格等于该阶段所有 `steps[].minutes` 之和
- **AND** prompt version SHALL 标记为 `smart-lesson-plan.v2`，schema 版本保持不变。

#### Scenario: 步骤时长总和不一致被规范化

- **WHEN** 阶段输出的步骤时长总和不等于阶段时长，产生 message 形如 `stage-step-duration-mismatch:<actual>:<expected>` 的 schema 校验 issue
- **THEN** worker SHALL 把该 issue 规范化为 code `stage-step-duration-mismatch` 的 correction 可处理错误
- **AND** 持久化的 validation receipt 与 correction 行为 SHALL 使用同一规范化错误。

#### Scenario: Correction 收到具体时长修正约束

- **WHEN** `stage-step-duration-mismatch` 是该次校验的唯一错误并触发自动 correction
- **THEN** correction context SHALL 携带阶段名称、实际步骤时长总和与目标阶段时长（以已确认 outline 的阶段时长为权威）
- **AND** correction 要求 SHALL 保持步骤数量、顺序、标题、教学活动、评价内容与 `sourceBindings` 不变，每个步骤时长为正整数且总和严格等于目标阶段时长，优先保持原时长比例，不扩展教学语义。

#### Scenario: 时长信息无法可靠解析或并存其他校验错误时诚实退化

- **WHEN** 错误 message 不携带可解析的实际值/目标值，权威 outline 阶段时长不可得，或该次校验还并存其他 schema 错误
- **THEN** correction SHALL 退化使用通用 schema 修正提示
- **AND** SHALL NOT 猜测或伪造时长数值。

#### Scenario: 审计与调用上限不变

- **WHEN** 一次 ORIGINAL attempt 后触发 CORRECTION attempt
- **THEN** 两个 attempt SHALL 独立持久化并以 `correctsAttemptId` 关联，原始输出与 validation receipt SHALL 保留不被覆盖
- **AND** 阶段 SHALL NOT 获得第二次 CORRECTION 调用。

