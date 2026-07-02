## Purpose

Define the governed materialization layer that writes learning evidence into K/A/Q overlay state with source authority, version references, privacy projection, and auditability.
## Requirements
### Requirement: K/A/Q evidence writeback is governed
The system SHALL materialize evidence into knowledge, capability, and quality overlay updates only through a governed writeback contract.

#### Scenario: Evidence is routed to graph targets
- **WHEN** path execution, exercise, grading, simulation, Arena, or Konling intervention evidence is considered for graph overlay updates
- **THEN** the writeback layer SHALL identify target K/A/Q objective or graph node refs, evidence source class, authority level, confidence, evidence window, privacy scope, version refs, and limitations
- **AND** knowledge, capability, and quality contributions SHALL remain separate even when they originate from the same source.

#### Scenario: Evidence lacks target binding
- **WHEN** evidence cannot be tied to a K/A/Q objective, graph node, LearningGoal boundary, or governed evidence policy
- **THEN** production overlay writeback SHALL be rejected or downgraded
- **AND** the limitation SHALL be visible to authorized diagnostics.

#### Scenario: Evidence targets an unknown LearningGoal
- **WHEN** evidence names a LearningGoal id that is not present in the registered LearningGoal catalog
- **THEN** production overlay writeback SHALL be rejected before terminal validation or overlay materialization
- **AND** the limitation SHALL be visible to authorized diagnostics.

#### Scenario: Evidence target falls outside the LearningGoal boundary
- **WHEN** evidence names a registered LearningGoal but its K/A/Q objective or graph node target is outside that LearningGoal boundary
- **THEN** production overlay writeback SHALL be rejected before terminal validation or overlay materialization
- **AND** the limitation SHALL be visible to authorized diagnostics.

#### Scenario: Evidence targets a ResourceNode
- **WHEN** evidence includes a ResourceNode target
- **THEN** the writeback layer SHALL require resource registry and projection version refs
- **AND** it SHALL materialize the target only when the ResourceNode id is present in verified registry or projection input.

### Requirement: Preview and official evidence are distinct
The system SHALL distinguish exploratory or preview evidence from governed terminal validation evidence.

#### Scenario: Preview evidence is materialized
- **WHEN** simulation preview, Arena preview, navigation, passive view, generic chat, or context-only activity is materialized
- **THEN** it MAY contribute low-confidence context according to policy
- **AND** it SHALL NOT satisfy official terminal validation or high-confidence mastery by itself.

#### Scenario: Non-terminal evidence violates LearningGoal evidence policy
- **WHEN** preview, official, or context evidence targets a LearningGoal whose evidence policy does not accept that evidence type
- **THEN** the writeback SHALL reject the contribution before overlay materialization
- **AND** the limitation SHALL be visible to authorized diagnostics.

#### Scenario: Arena preview uses SimulationRun source refs
- **WHEN** Arena preview evidence is materialized from its canonical SimulationRun envelope
- **THEN** the writeback SHALL accept the SimulationRun source ref for preview context overlay materialization
- **AND** it SHALL continue to reject terminal validation for the preview-only contribution.

#### Scenario: Official validation is materialized
- **WHEN** official Arena evaluation, governed simulation validation, teacher-approved grading, or a policy-approved checkpoint is materialized
- **THEN** it MAY update terminal validation or capability state only if required source, LearningGoal evidence policy, scope, confidence, and version refs pass validation.

#### Scenario: Terminal validation evidence violates LearningGoal policy
- **WHEN** evidence requests terminal validation for a LearningGoal whose policy does not accept that evidence type
- **THEN** terminal validation SHALL be rejected for that contribution
- **AND** the limitation SHALL be visible to authorized diagnostics.

#### Scenario: Teacher-approved grading uses rubric score scale
- **WHEN** teacher-approved grading evidence is built from a raw rubric score and rubric max score
- **THEN** the writeback confidence SHALL be normalized by the max score
- **AND** terminal validation SHALL only be requested when the normalized score passes the terminal validation threshold.

#### Scenario: Teacher-approved grading has invalid rubric max score
- **WHEN** teacher-approved grading evidence supplies a non-positive or non-finite rubric max score
- **THEN** terminal validation SHALL be rejected for that contribution
- **AND** the limitation SHALL be visible to authorized diagnostics.

### Requirement: AI-generated evidence is flagged
Evidence writeback SHALL preserve whether AI produced or mediated the source.

#### Scenario: Konling intervention outcome is written
- **WHEN** a Konling intervention, recommendation, or tool outcome is materialized as evidence
- **THEN** the writeback SHALL flag AI involvement, identify the AgentToolRun or governed outcome ref, preserve citations where available, and avoid using raw model narrative as high-confidence mastery evidence.

#### Scenario: Konling intervention remains AI-mediated after approval
- **WHEN** a Konling intervention source is teacher-confirmed or otherwise approved for materialization
- **THEN** the writeback SHALL preserve AI-mediated authority for the AgentToolRun evidence
- **AND** approval SHALL NOT upgrade the source to teacher-approved evidence authority.

#### Scenario: Citation refs are normalized
- **WHEN** an AI-mediated or governed source supplies citation refs for materialization
- **THEN** the writeback SHALL trim citation ref ids and remove blank citation refs before audit or overlay materialization
- **AND** version-ref requirements SHALL be evaluated from the normalized citation ref list.

### Requirement: Evidence writeback is auditable
Production writeback SHALL emit an audit trail suitable for replay and diagnosis.

#### Scenario: Writeback succeeds
- **WHEN** a graph-aware evidence update is written
- **THEN** the audit record SHALL include source refs, target refs, version refs, confidence, limitation codes, actor or service, privacy scope, materializedAt, and AI-generated or teacher-approved flags.

#### Scenario: Writeback is blocked
- **WHEN** writeback is rejected or degraded because evidence, scope, target, citation, or version context is missing
- **THEN** the audit record SHALL include the blocking reason without fabricating overlay state.

#### Scenario: Version refs are blank
- **WHEN** a writeback supplies required version refs, including the artifact versioning schema ref, as blank strings
- **THEN** the writeback SHALL treat those refs as missing before validation and audit materialization.

#### Scenario: Artifact versioning schema ref is stale
- **WHEN** a writeback supplies a non-current artifact versioning schema ref
- **THEN** the writeback SHALL surface a stale version limitation before terminal validation.

#### Scenario: Writeback refs are missing
- **WHEN** a production writeback lacks a replayable writeback id
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Materialization time is not replayable
- **WHEN** a production writeback lacks a replayable materializedAt timestamp
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Evidence window is not replayable
- **WHEN** a production writeback contains blank, non-replayable, or inverted evidence-window timestamps
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Evidence window lacks replayable end time
- **WHEN** a production writeback evidence window lacks a strict end timestamp
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Evidence window extends beyond materialization time
- **WHEN** a production writeback evidence window contains timestamps after materializedAt
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Actor refs are missing
- **WHEN** a production writeback lacks a replayable actor or service id
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Source refs are missing
- **WHEN** a production source lacks a replayable source id, source ref kind, or source ref id
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

#### Scenario: Source refs do not match source authority
- **WHEN** a production source ref kind does not match the declared evidence source class or the source ref id does not match the source id
- **THEN** the writeback SHALL be blocked before terminal validation or overlay materialization.

### Requirement: Arena KAQ writeback shall be persistently materialized
Accepted official Arena submissions SHALL produce an idempotent persisted learning-evidence writeback outcome.

#### Scenario: an official Arena submission is accepted
- **WHEN** an official Arena submission is accepted for a student and maps to valid KAQ targets
- **THEN** the system SHALL materialize a persisted writeback outcome with source submission, student, KAQ refs, artifact version, status, confidence, and limitation codes.
- **AND** repeating the same accepted submission SHALL NOT create duplicate learning facts.

#### Scenario: an Arena attempt is late, zero, invalid, duplicate-only, or unmapped
- **WHEN** an Arena attempt is late, zero, invalid, duplicate-only, unauthorized, or lacks valid KAQ mapping
- **THEN** the system SHALL persist or expose a blocked/degraded outcome and SHALL NOT create positive mastery evidence.

### Requirement: Arena writeback consumers shall share one outcome
Student feedback, teacher reports, evidence timelines, path planning, and assistant context SHALL read the same Arena writeback outcome.

#### Scenario: a consumer displays Arena evidence
- **WHEN** a student, teacher, planner, or assistant context reads Arena learning evidence
- **THEN** it SHALL use the persisted writeback outcome and SHALL NOT recompute a conflicting status from UI-only projection.

#### Scenario: writeback is pending or degraded
- **WHEN** materialization is pending, degraded, or blocked
- **THEN** every consumer SHALL show consistent status language and limitation reason.

### Requirement: Arena writeback audit closure shall be evidence backed
Arena evidence writeback findings SHALL be closed only with linked implementation evidence.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference tests, persisted outcome evidence, and residual scope.
