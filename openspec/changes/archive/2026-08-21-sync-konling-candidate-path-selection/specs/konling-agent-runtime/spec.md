## MODIFIED Requirements

### Requirement: Konling exposes governed adaptive path tools
Konling SHALL expose scoped tools for adaptive learning path generation, revision, persisted-candidate selection, rejection, explanation, and outcome recording.

#### Scenario: Konling invokes graph-driven path generation
- **WHEN** a student asks Konling to generate or revise a graph-driven learning path
- **THEN** Konling SHALL call the governed planner tool with server-owned LearningGoal, graph subgoal, learner, class, resource, path, and privacy context
- **AND** it SHALL preserve AgentToolRun audit, idempotency, and permission constraints.

#### Scenario: Konling handles a candidate selection request
- **WHEN** a student asks Konling to choose from a persisted candidate batch
- **THEN** Konling SHALL resolve the request against that authorized batch and call the existing path-choice contract only for one verified candidate
- **AND** unique resolution SHALL remain `pending_commit` until that governed path-choice mutation succeeds
- **AND** Konling SHALL NOT represent `pending_commit` as a completed selection
- **AND** an ambiguous request SHALL produce a structured clarification turn without side effects.

### Requirement: Path tools are auditable and idempotent
Konling path-generation and persisted-candidate selection tools SHALL use the shared AgentToolRun audit and idempotency contract.

#### Scenario: Tool call starts
- **WHEN** Konling accepts a path-generation, revision, selection, or rejection tool call
- **THEN** the system SHALL persist tool name, agent session, actor user, target user, goal, permission tier, approval state, correlation id, idempotency key, and redacted input summary before executing side effects.

#### Scenario: Idempotent request repeats
- **WHEN** the same owner user repeats the same path-generation request or confirmed candidate selection with the same idempotency key
- **THEN** the system SHALL reuse or return the existing tool run according to registry policy
- **AND** a different explicit candidate or different natural-language intent under that key SHALL fail with a conflict
- **AND** it SHALL NOT create duplicate active path rounds or path choices.
