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

### Requirement: Preview and official evidence are distinct
The system SHALL distinguish exploratory or preview evidence from governed terminal validation evidence.

#### Scenario: Preview evidence is materialized
- **WHEN** simulation preview, Arena preview, navigation, passive view, generic chat, or context-only activity is materialized
- **THEN** it MAY contribute low-confidence context according to policy
- **AND** it SHALL NOT satisfy official terminal validation or high-confidence mastery by itself.

#### Scenario: Official validation is materialized
- **WHEN** official Arena evaluation, governed simulation validation, teacher-approved grading, or a policy-approved checkpoint is materialized
- **THEN** it MAY update terminal validation or capability state only if required source, scope, confidence, and version refs pass validation.

### Requirement: AI-generated evidence is flagged
Evidence writeback SHALL preserve whether AI produced or mediated the source.

#### Scenario: Konling intervention outcome is written
- **WHEN** a Konling intervention, recommendation, or tool outcome is materialized as evidence
- **THEN** the writeback SHALL flag AI involvement, identify the AgentToolRun or governed outcome ref, preserve citations where available, and avoid using raw model narrative as high-confidence mastery evidence.

### Requirement: Evidence writeback is auditable
Production writeback SHALL emit an audit trail suitable for replay and diagnosis.

#### Scenario: Writeback succeeds
- **WHEN** a graph-aware evidence update is written
- **THEN** the audit record SHALL include source refs, target refs, version refs, confidence, limitation codes, actor or service, privacy scope, materializedAt, and AI-generated or teacher-approved flags.

#### Scenario: Writeback is blocked
- **WHEN** writeback is rejected or degraded because evidence, scope, target, citation, or version context is missing
- **THEN** the audit record SHALL include the blocking reason without fabricating overlay state.
