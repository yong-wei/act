## ADDED Requirements

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
- **WHEN** confirmed course-basis versions are available
- **THEN** the system MAY propose knowledge-point candidates from governed retrieval
- **AND** each candidate SHALL retain source bindings or an explicit source-gap state.

#### Scenario: Teacher edits suggested knowledge points
- **WHEN** a teacher selects, renames, or merges suggested candidates
- **THEN** the task SHALL record the resulting teacher-confirmed knowledge points and their lineage
- **AND** generation SHALL use the confirmed result rather than the original suggestions.

#### Scenario: Teacher creates a knowledge point manually
- **WHEN** a teacher enters a knowledge point that was not suggested
- **THEN** the system SHALL retain it as teacher-created
- **AND** it SHALL allow source binding or an explicit source-gap state without requiring a full knowledge-graph writeback.

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
