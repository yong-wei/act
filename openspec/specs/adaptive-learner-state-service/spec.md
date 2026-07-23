# adaptive-learner-state-service Specification

## Purpose
Define the server-owned adaptive learner-state read model used by path planning, personalization, profile, and Konling consumers.
## Requirements
### Requirement: Learner state is server-owned
The system SHALL provide a server-owned Learner State Service for adaptive-learning consumers.

#### Scenario: Path planner requests learner state
- **WHEN** the path planner requests learner state for a student
- **THEN** the service SHALL return primary competency state, second-level competency state, knowledge mastery, resource preference, media absorption, risks, path context, evidence windows, and confidence markers
- **AND** missing, stale, partial, or low-confidence evidence SHALL be explicit.

#### Scenario: Client sends profile hints
- **WHEN** a client sends profile-like values to an AI or path endpoint
- **THEN** the server SHALL treat them as hints only
- **AND** authoritative adaptive state SHALL come from the Learner State Service.

### Requirement: Learner state retains and extends competency dimensions
The system SHALL expose portrait v2 as the primary learner portrait dimensions
while retaining legacy six-dimensional competency values only as
compatibility or migration metadata.

#### Scenario: Learner state is returned
- **WHEN** learner state is read after portrait v2 is available
- **THEN** it SHALL include the seven portrait v2 dimensions as the primary learner portrait
- **AND** any `controlModeling`, `parameterDesign`, `crossDomainTransfer`, `engineeringDecision`, `inquiryReflection`, or `selfDirectedLearning` values SHALL be marked as legacy compatibility or migration inputs rather than primary dimensions.
- **AND** it SHALL include second-level dimensions for concept mastery, time/frequency transfer, modeling reliability, tuning efficiency, constrained optimization, solution stability, cross-modal transfer, scenario generalization, risk recognition, constraint compliance, explanation quality, AI-use strategy, reflection depth, path execution, persistence, and remedial initiative where evidence exists.

### Requirement: Learner-state fields are quantified and scoped
The system SHALL declare quantification and privacy metadata for learner-state field families.

#### Scenario: Field family is added
- **WHEN** a learner-state field family is introduced
- **THEN** it SHALL declare value range, source families, algorithm version, evidence threshold, confidence policy, fallback reason, and privacy scope
- **AND** consumers SHALL NOT treat undeclared or low-confidence fields as high-confidence personalization state.

### Requirement: Learner state exposes the control-correction goal slice
The system SHALL expose a governed `control-correction` learner-state slice that can be consumed by path planning, Konling coaching, student UI, and teacher reports.

#### Scenario: Goal slice is requested
- **WHEN** an authorized student, teacher, or service requests learner state for `goal=control-correction`
- **THEN** the response SHALL include stable dimensions for time-domain analysis, root-locus reasoning, frequency-domain margin analysis, method selection, constraint tradeoff, simulation validation, Arena transfer, reflection, and AI-collaboration evidence
- **AND** each dimension SHALL include level, score or band, source coverage, evidence count, freshness, confidence, and privacy visibility metadata.

#### Scenario: Evidence is incomplete
- **WHEN** one or more control-correction dimensions lack sufficient governed evidence
- **THEN** the learner-state slice SHALL mark missing, stale, partial, or low-confidence dimensions explicitly
- **AND** it SHALL NOT present low-evidence dimensions as complete high-confidence mastery.

#### Scenario: Existing learner-state consumers read general state
- **WHEN** a consumer does not request the `control-correction` goal slice
- **THEN** existing learner-state payloads SHALL remain compatible
- **AND** the new goal slice SHALL NOT be required for unrelated adaptive-learning surfaces.

### Requirement: Learner state consumes registered goal slices
The Learner State Service SHALL resolve goal-specific read models through the adaptive goal-slice registry.

#### Scenario: Registered goal slice is read
- **WHEN** learner state is requested for a registered goal
- **THEN** the service SHALL return only dimensions and metadata declared by that goal contract
- **AND** it SHALL include confidence, source coverage, freshness, and privacy metadata for each visible field family.
- **AND** it SHALL preserve declared non-dimensional field families such as active path context, recent path rounds, terminal validation state, and no-active-path state when those families are part of the goal contract.

#### Scenario: Registered control-correction path context is read
- **WHEN** learner state is requested for `goal=control-correction`
- **THEN** the registered goal contract SHALL allow the active path id, status, current node, terminal validation state, and no-active-path state required by control-correction path consumers
- **AND** registry filtering SHALL NOT remove those fields merely because they are not competency dimensions.

#### Scenario: General learner state is read
- **WHEN** no goal is requested
- **THEN** existing general learner-state payloads SHALL remain compatible
- **AND** registered goal slices SHALL NOT be required for unrelated adaptive surfaces.

### Requirement: Learner state links to active control-correction path rounds
The system SHALL expose privacy-safe references from learner state to active or recent control-correction path rounds when authorized.

#### Scenario: Active path exists
- **WHEN** learner state is requested for `goal=control-correction` and an active path exists for the student
- **THEN** the learner-state payload SHALL include the active path id, status, current node, terminal validation state, and low-confidence markers needed by downstream consumers
- **AND** it SHALL NOT embed raw execution payloads or private Konling dialogue.

#### Scenario: No active path exists
- **WHEN** no active control-correction path exists
- **THEN** learner state SHALL expose an explicit no-active-path state
- **AND** path planning consumers SHALL be able to distinguish that state from a failed learner-state read.

### Requirement: Learner state is enabled in production runtime
The Learner State Service SHALL be enabled in production app and worker runtimes.

#### Scenario: Production app starts
- **WHEN** the production app container is created
- **THEN** `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED` SHALL be set to `true`
- **AND** learner-state API and Konling runtime reads SHALL treat the service as available.

#### Scenario: Production worker starts
- **WHEN** the production worker container is created
- **THEN** it SHALL receive the same learner-state service flag as the app container
- **AND** background evidence or feature-cache tasks SHALL not run with a contradictory disabled learner-state assumption.

#### Scenario: Deployment examples are inspected
- **WHEN** operators inspect local and production environment examples
- **THEN** the examples SHALL document `ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true` as the expected production value
- **AND** model-provider examples SHALL not imply that learner-state is optional for normal production Konling behavior.

### Requirement: Learner-state no-data states are explicit
The Learner State Service SHALL distinguish an unavailable service from an available service with sparse or missing learner data.

#### Scenario: New learner has no evidence
- **WHEN** learner-state is requested for a learner with no relevant evidence rows
- **THEN** the service SHALL return an explicit low-confidence or no-evidence state
- **AND** it SHALL NOT present missing evidence as a failed learner-state read.

#### Scenario: Learner has no active path
- **WHEN** learner-state is requested for a goal that has no active path for the learner
- **THEN** the service SHALL return an explicit no-active-path state
- **AND** consumers SHALL be able to distinguish it from path read failure.

### Requirement: Learner portrait state uses portrait v2 as primary model
The learner-state service SHALL expose a canonical seven-dimensional portrait
v2 payload as the primary learner portrait.

#### Scenario: Portrait v2 state is read
- **WHEN** the learner-state service returns current portrait data
- **THEN** it SHALL include all seven portrait v2 dimensions with score, confidence, freshness, evidence counts, source lineage, and calculation version
- **AND** it SHALL identify any migrated legacy values with limitation metadata.

#### Scenario: Legacy portrait state exists
- **WHEN** only legacy six-dimensional snapshot data exists for a learner
- **THEN** the service MAY derive portrait v2 compatibility values
- **AND** it SHALL mark the result as migrated or compatibility-derived rather than native portrait v2 evidence.

### Requirement: Portrait source lineage is privacy scoped
The learner-state service SHALL keep portrait source lineage auditable without
leaking raw or unauthorized evidence to learner-facing or AI-facing consumers.

#### Scenario: Learner-facing portrait is returned
- **WHEN** portrait v2 data is returned to a student-facing profile, Konling, or planner consumer
- **THEN** source lineage SHALL be redacted to allowed evidence-family, citation, aggregate, or hashed refs
- **AND** raw source payloads, teacher-scoped refs, private fixture refs, and migration-source snapshot ids SHALL NOT be exposed unless the caller is authorized for that evidence scope.

#### Scenario: Reviewer or administrator audits lineage
- **WHEN** an authorized reviewer or administrator requests audit details
- **THEN** the system MAY expose richer lineage metadata
- **AND** the response SHALL still respect role scope, privacy minimization, and export boundaries.

### Requirement: Learner portrait updates are stable and incremental
The learner portrait update engine SHALL treat portrait data as long-term state
that is incrementally corrected by new governed evidence.

#### Scenario: No new evidence is available
- **WHEN** a learner has an existing portrait v2 state
- **AND** no new governed evidence affects a dimension
- **THEN** the dimension score SHALL be preserved
- **AND** confidence or freshness MAY change according to a documented aging policy.

#### Scenario: Sparse evidence affects one dimension
- **WHEN** new evidence affects only one portrait dimension
- **THEN** only that dimension SHALL receive a score update
- **AND** unrelated dimensions SHALL NOT be reset to zero.

#### Scenario: Negative evidence is processed
- **WHEN** governed evidence explicitly indicates failure, misconception, unsafe action, or low-quality work
- **THEN** affected dimensions MAY decrease through a bounded update
- **AND** the update SHALL include rationale and evidence lineage.

#### Scenario: Context-only evidence is processed
- **WHEN** a LearningFact or event is marked as context-only or has no profile contribution
- **THEN** it SHALL NOT overwrite any portrait score
- **AND** it MAY appear in evidence context or activity history.

### Requirement: Legacy learner portraits migrate to portrait v2 with lineage
The system SHALL provide an auditable migration path from legacy
six-dimensional learner portrait data to primary seven-dimensional portrait v2
records.

#### Scenario: Legacy snapshot is migrated
- **WHEN** a legacy six-dimensional snapshot is migrated
- **THEN** the resulting portrait v2 record SHALL include source snapshot refs, mapping version, mapping confidence, limitation metadata, original timestamp, and migration timestamp
- **AND** the migration SHALL NOT claim native portrait v2 evidence when values are compatibility-derived.

#### Scenario: Migration is rerun
- **WHEN** the migration apply path runs more than once
- **THEN** it SHALL be idempotent
- **AND** it SHALL NOT duplicate portrait rows or erase source lineage.

#### Scenario: Canonical fixture account is migrated
- **WHEN** Yang Fan diagnostic fixture data is generated or migrated
- **THEN** the canonical student number and canonical email SHALL identify the target account
- **AND** display-name-only duplicate accounts SHALL NOT receive fixture overwrite data.

### Requirement: Portrait materialization has a transaction-scoped concurrency guard

The learner portrait update engine SHALL serialize the complete per-learner
snapshot read/update/write unit and SHALL acquire the required database lock
before reading the previous snapshot.

#### Scenario: Concurrent materializations target one learner

- **WHEN** two portrait materialization jobs target the same learner
- **THEN** only one job at a time SHALL read and update that learner's
  incremental snapshot baseline
- **AND** the transaction-scoped lock SHALL be released when the transaction
  commits or rolls back.

#### Scenario: Transaction lock support is unavailable

- **WHEN** the production Prisma transaction client cannot acquire the required
  advisory lock
- **THEN** portrait materialization SHALL fail closed
- **AND** it SHALL NOT write a snapshot without the concurrency guard.

### Requirement: Learner portrait consumers use portrait v2
Learner-state consumers SHALL treat portrait v2 as the primary learner portrait
for student-facing and personalization-facing behavior.

#### Scenario: Student profile is rendered
- **WHEN** a student profile or growth surface displays learner portrait data
- **THEN** it SHALL render the seven portrait v2 dimensions
- **AND** it SHALL show migrated-data limitations when values are compatibility-derived.

#### Scenario: Learner context is produced
- **WHEN** learner-state context is prepared for adaptive planning, Konling, or diagnostics
- **THEN** weak dimensions, strengths, limitations, and evidence summaries SHALL use portrait v2 ids
- **AND** legacy six-dimensional ids SHALL appear only in compatibility metadata.

#### Scenario: Evidence feature cache is used as fallback
- **WHEN** learner-state service reads `StudentEvidenceFeatureCache` or approved aggregate fallback data
- **THEN** portrait v2 payloads SHALL be versioned or marked as native portrait v2
- **AND** legacy six-dimensional `competencyVector` values SHALL NOT re-enter learner-state as primary portrait dimensions.

#### Scenario: Recommendations are generated
- **WHEN** profile or learner-state code generates personalized recommendations or `LearningRecommendation` rationale
- **THEN** weak-dimension references SHALL use portrait v2 ids, confidence, freshness, and limitation metadata
- **AND** recommendation records SHALL NOT persist legacy six-dimensional ids as primary portrait rationale.

### Requirement: Historical native portraits remain visible after recent activity ends
The learner-state service SHALL treat a valid native portrait v2 as cumulative
attainment derived from all materialized historical facts, independent of
whether the learner has facts in a recent classroom window.

#### Scenario: Learner has older facts but no recent facts
- **WHEN** a learner has a valid native portrait v2 rebuilt from historical
  facts and has no fact in the recent class window
- **THEN** student-facing portrait consumers SHALL return the native portrait
- **AND** they SHALL expose its generation timestamp without reporting a
  no-evidence state.

#### Scenario: Learner has no facts
- **WHEN** a learner has no historical `LearningFact`
- **THEN** the learner-state service SHALL retain an explicit no-evidence state
- **AND** it SHALL NOT create or display a synthetic zero-valued portrait.

#### Scenario: Learner facts do not contribute portrait evidence
- **WHEN** the current native portrait is absent because historical facts are
  context-only or otherwise provide no governed portrait contribution
- **THEN** the growth page SHALL show an explicit no-evidence state and a real
  learning-activity entry
- **AND** it SHALL NOT show a zero score, learning stage, positive capability
  conclusion, or capability cards.

