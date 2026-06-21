# goal-subgraph-expansion Specification

## Purpose
TBD - created by archiving change add-goal-subgraph-expansion-and-prerequisite-policy. Update Purpose after archive.
## Requirements
### Requirement: Prerequisite policy semantics are explicit
The system SHALL resolve graph relations into planner-safe prerequisite policy semantics.

#### Scenario: Graph relations are resolved
- **WHEN** goal subgraph expansion reads graph edges
- **THEN** it SHALL classify relevant relations as hard prerequisite, soft prerequisite, co-requisite, remediation, extension, transfer, or evidence relations where supported
- **AND** weak or unknown relation semantics SHALL be exposed as limitations.

### Requirement: Goal subgraph expansion is not path generation
Goal subgraph expansion SHALL remain a read-only graph interpretation layer.

#### Scenario: Expansion result is requested
- **WHEN** a caller requests an expanded subgraph
- **THEN** the service SHALL NOT select ResourceNodes, rank resources, write learner overlay, write mastery, or create a path round
- **AND** downstream planner or Konling callers SHALL consume the expansion as input.

### Requirement: LearningGoals expand into versioned K/A/Q subgraphs
The system SHALL expand a LearningGoal into a versioned K/A/Q goal subgraph before path planning or graph-aware assistant grounding.

#### Scenario: Goal subgraph is expanded
- **WHEN** a `path-ready` LearningGoal is expanded
- **THEN** the result SHALL include learningGoalId, learningGoalVersion, graphVersion, knowledge node ids, capability node ids, quality node ids, required edges, recommended edges, checkpoint suggestions, terminal validation candidates, and limitations
- **AND** graph body node definitions SHALL remain unchanged.

#### Scenario: Goal binding is incomplete
- **WHEN** a LearningGoal references missing or inactive graph nodes
- **THEN** expansion SHALL return a governed limitation or reject the LearningGoal according to its status
- **AND** it SHALL NOT fabricate graph nodes or inferred prerequisites.

#### Scenario: Legacy package field reaches expansion
- **WHEN** a caller supplies a legacy payload or field named `learningGoalPackage` whose id matches a registered LearningGoal id
- **THEN** expansion SHALL resolve the canonical LearningGoal record
- **AND** the expansion output SHALL identify the target as `learningGoalId`, not as a package id.

