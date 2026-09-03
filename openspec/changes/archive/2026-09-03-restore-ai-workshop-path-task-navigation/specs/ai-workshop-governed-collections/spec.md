## MODIFIED Requirements

### Requirement: Task and milestone collections require adopted persistent learning work
The task collection SHALL include only assignments published to the authenticated student and tasks from a student-adopted persisted learning path. The milestone collection SHALL include only ordered nodes from a persisted path with authoritative pending, current, or completed state. Every path task SHALL expose a server-generated navigation target that preserves the learning goal, path identity, node identity, and `path-execution` intent required to continue or inspect that task.

#### Scenario: Published assignment is available to the student
- **WHEN** an assignment domain read confirms that an assignment revision is published to the authenticated student
- **THEN** the task collection SHALL expose its stable assignment identity, current permitted state, deadline context where applicable, and next action.

#### Scenario: Student has an adopted persisted path
- **WHEN** Learner State identifies an adopted persisted path with ordered nodes
- **THEN** eligible path tasks and milestones SHALL retain the path and node identities and authoritative state
- **AND** the current node SHALL remain distinguishable from completed and pending nodes.

#### Scenario: A path task is rendered as an actionable item
- **WHEN** the server projects an uncompleted node from an adopted path into the task collection
- **THEN** its navigation target SHALL include the server-confirmed goal, path ID, node ID, and `intent=path-execution`
- **AND** all navigation values SHALL be URL encoded
- **AND** the target SHALL not be constructed from client-provided collection data.

#### Scenario: A path lacks executable navigation context
- **WHEN** the adopted path has no valid goal, no valid node, or an invalid persisted path context
- **THEN** the task collection SHALL not expose a generic practice URL as if it continued that task
- **AND** it SHALL expose an honest unavailable or recovery action according to the collection contract.

#### Scenario: Candidate work has not been adopted
- **WHEN** a recommendation, report-feedback task candidate, Copilot suggestion, or browser-only task selection has not been persisted through its explicit adoption flow
- **THEN** it SHALL NOT appear as a governed task or milestone.

