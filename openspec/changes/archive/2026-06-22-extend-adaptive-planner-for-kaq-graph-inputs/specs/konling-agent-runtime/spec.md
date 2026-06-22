## MODIFIED Requirements

### Requirement: Konling exposes governed adaptive path tools
Konling SHALL expose scoped tools for adaptive learning path generation, revision, selection, rejection, explanation, and outcome recording.

#### Scenario: Konling invokes graph-driven path generation
- **WHEN** a student asks Konling to generate or revise a graph-driven learning path
- **THEN** Konling SHALL call the governed planner tool with server-owned LearningGoal, graph subgoal, learner, class, resource, path, and privacy context
- **AND** it SHALL preserve AgentToolRun audit, idempotency, and permission constraints.
