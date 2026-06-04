# adaptive-learning-path-planning Specification

## Purpose
Defines the Stage 1 adaptive learning path planner contract: deterministic rules plus graph search over learner state and ResourceNodes, explainable scoring, visualization payloads, and feedback/correction records without contextual bandit or reinforcement learning.
## Requirements
### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, teacher policy, and planning constraints.

#### Scenario: Planner creates a feasible path
- **WHEN** a student requests a learning path with a time budget and learning goal
- **THEN** the planner SHALL infer deficits, filter ResourceNodes, apply prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints
- **AND** it SHALL return a feasible plan DAG with current node, next nodes, alternatives, estimates, and explanations.

#### Scenario: Planner exposes fallback state
- **WHEN** learner evidence or resource mapping is insufficient for a confident path
- **THEN** the planner SHALL return a low-confidence or fallback path state
- **AND** it SHALL explain which evidence or mapping gaps limit personalization.

### Requirement: Objective function is multi-objective
The system SHALL score candidate paths with a multi-objective function rather than optimizing only for speed or score.

#### Scenario: Candidate path is scored
- **WHEN** the planner compares candidate paths
- **THEN** it SHALL consider expected learning gain, engagement, constraint satisfaction, diversity, fatigue, and dropout risk
- **AND** it SHALL expose reason metadata for the selected path and rejected alternatives.

### Requirement: Stage 1 planner excludes contextual bandit and RL
The system SHALL generate Stage 1 MVP paths without contextual bandit, reinforcement learning, or long-horizon hybrid policies.

#### Scenario: Stage 1 planner runs
- **WHEN** Stage 1 path planning is active
- **THEN** rules plus graph search SHALL produce feasible paths and deterministic explanation metadata
- **AND** contextual bandit SHALL NOT be required for a feasible path or visualization.

### Requirement: Learning path visualization is available
The system SHALL expose path visualization data for map, timeline, and evidence views.

#### Scenario: Map view data is requested
- **WHEN** a student or authorized teacher opens the path map
- **THEN** the response SHALL include main path, branch paths, current node, completed nodes, risk nodes, blocked nodes, and alternatives.

#### Scenario: Evidence view data is requested
- **WHEN** a user inspects why a node was recommended
- **THEN** the response SHALL include evidence basis, confidence, source coverage, learner-state deficits, prerequisite reasons, teacher policy, and alternative nodes.

### Requirement: Path execution feedback is captured
The system SHALL capture path adoption, completion, deviation, correction, explanation clicks, and helpfulness feedback.

#### Scenario: Student deviates from path
- **WHEN** a student skips, replaces, or abandons a path node
- **THEN** the system SHALL record the deviation with context
- **AND** the planner SHALL be able to generate a correction path without losing the prior evidence chain.

### Requirement: Planner consumes the control-correction seed graph
The system SHALL be able to generate candidate paths from the audited control-correction ResourceNode seed graph.

#### Scenario: Feasible control-correction path is requested
- **WHEN** the planner receives a `control-correction` goal, learner-state slice, time budget, and teacher policy
- **THEN** it SHALL select only path-eligible seed nodes whose prerequisites, availability, privacy, terminal constraints, and evidence instrumentation pass audit
- **AND** it SHALL return a candidate path that includes explanatory reasons and a terminal validation strategy when sufficient evidence exists.

#### Scenario: Required terminal validation is unavailable
- **WHEN** no audited simulation or Arena validation node is available for the requested path constraints
- **THEN** the planner SHALL return a fallback or low-confidence path state
- **AND** it SHALL explain the missing resource or mapping gap instead of silently ending with a non-validation node.

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

### Requirement: Control-correction paths use simulation and Arena terminal validation
The system SHALL determine control-correction path completion from configured simulation and Arena validation evidence rather than resource views alone.

#### Scenario: Terminal validation succeeds
- **WHEN** a student completes the required simulation and Arena validation nodes with governed evidence that meets the path policy
- **THEN** the path SHALL mark terminal validation as satisfied and may transition to completed
- **AND** the completion state SHALL reference privacy-safe evidence ids, provenance, replay confidence, and validation policy version.

#### Scenario: Terminal validation fails
- **WHEN** simulation metrics fail, Arena submission is invalid or low-scoring under policy, replay confidence is insufficient, or required evidence is missing
- **THEN** the path SHALL record a failed or low-confidence validation state
- **AND** it SHALL trigger an alternative path, fallback node, Konling correction, or teacher-visible risk marker according to policy.

#### Scenario: Validation node is only preview evidence
- **WHEN** the available Arena or simulation result is preview-only
- **THEN** the path SHALL mark the result as preview-only context unless policy explicitly allows preview validation
- **AND** it SHALL NOT present preview-only evidence as official evaluation, leaderboard, or hard terminal authority.
