# smart-courseware-publication Specification

## Purpose
TBD - created by archiving change publish-smart-courseware-to-classroom. Update Purpose after archive.
## Requirements
### Requirement: Publication gates are deterministic and content-bound
Courseware publication SHALL require passing static and fixed-viewport browser validation receipts for the exact draft content hash and SHALL NOT depend on LLM review judgment.

#### Scenario: Publication validation runs
- **WHEN** a teacher requests publication validation
- **THEN** the system SHALL apply the shared slide-runtime validators plus publication checks for required activities, student answer leakage, teaching-goal and module source-gap acknowledgements, AI labels, and plan-baseline identity
- **AND** every failure SHALL include a deterministic code and affected stage, step, or module.

#### Scenario: A validation receipt is recorded
- **WHEN** static or browser validation passes
- **THEN** the receipt SHALL record the content hash, validator version, browser/font versions when applicable, actor or worker, and completion time
- **AND** the receipt SHALL authorize only the exact content hash it measured.

#### Scenario: AI review disagrees with deterministic gates
- **WHEN** AI review passes but a deterministic gate fails, or AI review reports concerns while deterministic gates pass
- **THEN** only deterministic gate state and required teacher acknowledgements SHALL control publication eligibility
- **AND** the AI report SHALL remain advisory.

### Requirement: Source-gap acknowledgement is explicit and individual
Every unresolved teaching-goal or courseware-module source gap SHALL require an individual teacher acknowledgement before publication.

#### Scenario: A teaching goal has no verified source
- **WHEN** publication is requested from an approved plan containing a goal with canonical source state `ai_generated_source_pending` or `teacher_created_source_pending`
- **THEN** a matching acknowledgement SHALL identify the goal, stable gap id, goal content hash, source-gap state, teacher, time, and reason, and MAY record the current plan revision as audit context
- **AND** plan approval SHALL NOT create or infer that acknowledgement.

#### Scenario: A module has no verified source
- **WHEN** publication is requested for a module with canonical source state `ai_generated_source_pending` or `teacher_created_source_pending`
- **THEN** a matching acknowledgement SHALL identify the module, stable gap id, module content hash, source-gap state, teacher, time, and reason, and MAY record the current courseware draft hash as audit context
- **AND** editor review or whole-course approval SHALL NOT create or infer that acknowledgement.

#### Scenario: A source gap changes after acknowledgement
- **WHEN** the acknowledged goal or module content, source-binding set, canonical source state, or deletion-and-recreation changes its upstream stable gap identity
- **THEN** the prior acknowledgement SHALL no longer authorize publication
- **AND** a new acknowledgement SHALL be required for the new gap identity.

#### Scenario: Unrelated draft content changes after acknowledgement
- **WHEN** a plan revision, sibling module, or step order changes without changing an acknowledged goal or module's stable gap identity
- **THEN** that individual source-gap acknowledgement SHALL remain valid
- **AND** any static or browser receipt bound to the prior whole-draft content hash SHALL be invalidated and rerun.

#### Scenario: Upstream lifecycle never implies acknowledgement
- **WHEN** plan approval, editor review, whole-course approval, or projection transfers a pending source state and stable gap identity into publication
- **THEN** it SHALL transfer only the gap state and identity and SHALL NOT create an acknowledgement
- **AND** every gap in either canonical pending lineage state SHALL require its own explicit teacher acknowledgement.

#### Scenario: Goal gap is unacknowledged but module gaps are complete
- **WHEN** a courseware draft has verified module sources but its approved-plan baseline contains an unacknowledged goal source gap
- **THEN** deterministic publication validation SHALL fail with a goal-source-gap-acknowledgement code
- **AND** module citation completeness SHALL NOT release the unresolved goal gap.

#### Scenario: Canonical pending lineage states cross the publication boundary
- **WHEN** an approved plan or courseware draft contains either `ai_generated_source_pending` or `teacher_created_source_pending`
- **THEN** publication SHALL recognize the same canonical machine value without text parsing or capability-local enum conversion
- **AND** each goal or module gap SHALL require its own acknowledgement bound to the upstream stable gap identity.

### Requirement: Publication freezes an immutable courseware revision
Publishing a valid courseware draft SHALL create an immutable sequential courseware revision and a governed catalog/runtime projection.

#### Scenario: Teacher publishes current-baseline courseware
- **WHEN** the owning teacher publishes a draft with current valid receipts and all required acknowledgements
- **THEN** the system SHALL freeze it as `互动课件第N版（基于教案第M版）`, with N equal to the prior maximum plus one
- **AND** it SHALL preserve the manifest hash, plan revision, sources, provenance, acknowledgements, gate versions, and publication actor and time.

#### Scenario: Published courseware is edited
- **WHEN** a teacher edits content derived from a published courseware revision
- **THEN** the system SHALL create or update a mutable draft
- **AND** the published revision and existing classroom sessions SHALL remain unchanged.

#### Scenario: Publication projection is created
- **WHEN** a courseware revision is published
- **THEN** the system SHALL transactionally create or update its governed `LessonPlan`, `LessonItem`, `TeachingResource`, and generated-courseware projection links
- **AND** only a published projection SHALL appear as classroom-usable generated content.

### Requirement: Older lesson-plan baselines require explicit confirmation
The system SHALL warn when a courseware draft is based on an older approved lesson-plan revision and SHALL allow publication only after an explicit stale-baseline acknowledgement.

#### Scenario: A newer plan revision exists
- **WHEN** a teacher previews courseware whose baseline is older than the task's newest approved plan
- **THEN** the preview SHALL identify both version numbers and recommend regeneration
- **AND** the existing courseware SHALL remain previewable.

#### Scenario: Teacher publishes stale-baseline courseware
- **WHEN** the teacher explicitly confirms the displayed plan-version difference
- **THEN** publication MAY proceed if all other deterministic gates pass
- **AND** the acknowledgement actor, time, compared versions, and reason SHALL be stored.

#### Scenario: Confirmation is missing
- **WHEN** publication is requested against an older plan without a matching acknowledgement
- **THEN** deterministic publication validation SHALL fail with a stale-baseline-confirmation code.

### Requirement: The standard root-locus courseware demonstrates the complete P0 path
P0 acceptance SHALL exercise a 45-minute lesson on root-locus magnitude condition, angle condition, and basic drawing rules through the real smart-preparation workflow.

#### Scenario: Deterministic end-to-end acceptance runs
- **WHEN** automated acceptance uses the demonstration course basis and deterministic test provider
- **THEN** it SHALL cover natural-language task creation, one ambiguity clarification, a later-turn constraint revision, source import, goal confirmation, staged plan generation, plan approval, courseware generation, validation, publication, catalog projection, classroom binding, and student rendering
- **AND** the resulting courseware SHALL include all six BOPPPS stages, required executable activities, zero unresolved goal/module source gaps, and at least three representative content-quality cases compared with authoritative source anchors.

#### Scenario: Live contest demonstration runs
- **WHEN** the live demonstration generates the lesson
- **THEN** it SHALL use the existing Konling smart-preparation conversation for natural-language task creation, ambiguity clarification, and multi-turn revision, use an administrator-configured real provider, and show provider-backed generation audit to an authorized teacher or administrator
- **AND** any pre-existing backup revision SHALL be visibly identified as not generated during the current run.

