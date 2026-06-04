## ADDED Requirements

### Requirement: Control-correction path rounds are persisted
The system SHALL persist control-correction learning paths as durable path rounds with execution, explanation, alternative, and validation context.

#### Scenario: Path round is created
- **WHEN** a student or authorized service creates a `control-correction` learning path
- **THEN** the persisted path SHALL include goal reference, planner version, status, current node, learner-state input reference, path payload, explanation payload, alternative payload, entry resource node, terminal validation type, and last execution metadata
- **AND** the path SHALL be readable later without recomputing personalization from scratch.

#### Scenario: Path round is resumed
- **WHEN** a student resumes an active path
- **THEN** the system SHALL restore current node, completed nodes, failed nodes, alternatives, terminal validation state, and evidence confidence markers
- **AND** it SHALL preserve the evidence chain used to generate the original path.

### Requirement: Path execution, deviations, and interventions are append-only records
The system SHALL record path execution, deviation, and intervention activity as append-only records linked to the owning path.

#### Scenario: Node execution is recorded
- **WHEN** a path node starts, completes, fails, or is abandoned
- **THEN** the system SHALL record node id, resource type, status, timestamps, evidence references, derived lift metadata, and related simulation or Arena references where available.

#### Scenario: Student deviates from path
- **WHEN** a student skips, times out, manually jumps, requests help, or encounters a resource failure
- **THEN** the system SHALL record the deviation type, context, prior node, target node if any, and evidence confidence
- **AND** the planner SHALL be able to use this state when generating a correction path.

#### Scenario: Konling intervention is recorded
- **WHEN** Konling proposes a diagnosis, hint, rollback, fallback path, or reflection prompt for a path
- **THEN** the system SHALL record intervention kind, cited evidence, suggested action, student outcome, and privacy-safe summary.

### Requirement: Legacy recommendation compatibility is preserved
The system SHALL preserve existing recommendation and lightweight path consumers while persisted path rounds are introduced.

#### Scenario: Legacy recommendation consumer reads output
- **WHEN** a legacy consumer expects a `LearningRecommendation` or lightweight path summary
- **THEN** the system SHALL provide compatible output from existing data or a documented path-summary mapper
- **AND** disabling the control-correction path feature SHALL not break existing adaptive practice, profile, recommendation, or chat surfaces.
