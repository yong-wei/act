## ADDED Requirements

### Requirement: Planner supports registered learning goals
The adaptive path planner SHALL generate learning paths for registered learning goals rather than only for `control-correction`.

#### Scenario: Registered goal is requested
- **WHEN** a student requests a path for a registered learning goal
- **THEN** the planner SHALL load the goal strategy, allowed resource mix, checkpoint policy, time budget, and explanation templates
- **AND** it SHALL return executable path options with current node, alternatives, estimated time, evidence limits, and student-facing rationale.

#### Scenario: Unknown goal is requested
- **WHEN** a caller requests an unregistered learning goal
- **THEN** the system SHALL reject the request with a governed API error
- **AND** student entry surfaces SHALL still offer available registered goals or a generic starter path.

### Requirement: Cold-start learners receive executable starter paths
The planner SHALL treat cold start as a supported generation state, not as a no-path failure.

#### Scenario: Learner has no usable evidence
- **WHEN** a student with no governed learning evidence requests a path
- **THEN** the planner SHALL return at least two executable starter path options
- **AND** each option SHALL include resource nodes, at least one checkpoint, estimated time, and a clear student-facing explanation that evidence will improve personalization later.

#### Scenario: Learner evidence is low confidence
- **WHEN** learner evidence is partial, stale, or low confidence
- **THEN** the planner SHALL preserve usable path nodes
- **AND** it SHALL mark personalization confidence internally without clearing the main path solely because evidence is weak.

### Requirement: Generic path rounds are persisted
The system SHALL persist learning path rounds across registered goals.

#### Scenario: Generic path round is created
- **WHEN** a generated path option is created or selected
- **THEN** the persisted path SHALL include owner user, goal id, planner version, status, selected option, current node, path payload, explanation payload, alternative payload, and evidence window references
- **AND** it SHALL be resumable without recomputing the original path.

#### Scenario: Path activity is recorded
- **WHEN** a student generates, selects, rejects, switches, starts, completes, skips, resumes, or receives a Konling path adjustment
- **THEN** the system SHALL append a governed path activity record
- **AND** the activity SHALL be available to future recommendations without counting selection alone as mastery.

## MODIFIED Requirements

### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, registered goal strategy, teacher policy, and planning constraints.

#### Scenario: Planner creates a feasible path
- **WHEN** a student requests a learning path with a time budget and registered learning goal
- **THEN** the planner SHALL infer deficits when evidence exists, otherwise apply the goal's starter-path policy
- **AND** it SHALL filter ResourceNodes and apply prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints for both personalized and starter paths
- **AND** it SHALL return a feasible plan DAG with current node, next nodes, alternatives, estimates, and explanations.

#### Scenario: Planner exposes fallback state
- **WHEN** learner evidence or resource mapping is insufficient for confident personalization
- **THEN** the planner SHALL return a usable low-confidence starter or fallback path state
- **AND** internal diagnostic gaps SHALL be available to authorized teacher/admin diagnostics rather than student default UI.

### Requirement: Control-correction path rounds are persisted
The system SHALL persist control-correction paths through the generic path-round contract while preserving control-correction validation metadata.

#### Scenario: Control-correction path round is created
- **WHEN** a student or authorized service creates a `control-correction` path
- **THEN** the persisted path SHALL satisfy the generic path-round contract
- **AND** it SHALL include goal reference, planner version, status, current node, learner-state input reference, path payload, explanation payload, alternative payload, entry resource node, terminal validation type, terminal validation context, and last execution metadata.

#### Scenario: Control-correction path round is resumed
- **WHEN** a student resumes an active `control-correction` path
- **THEN** the system SHALL restore current node, completed nodes, failed nodes, alternatives, terminal validation state, and evidence confidence markers
- **AND** it SHALL preserve the evidence chain used to generate the original path.
