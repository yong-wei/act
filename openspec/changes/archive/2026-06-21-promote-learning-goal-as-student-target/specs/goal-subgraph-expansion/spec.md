## ADDED Requirements

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

## REMOVED Requirements

### Requirement: LearningGoal packages expand into versioned K/A/Q subgraphs
**Reason**: LearningGoals are now the student-facing target truth; keeping package wording as the primary requirement would preserve the deprecated nested model.

**Migration**: Callers should use LearningGoal ids and canonical LearningGoal metadata. Legacy `learningGoalPackage` payload fields remain readable only as compatibility input.
