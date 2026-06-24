## ADDED Requirements

### Requirement: Konling exposes governed adaptive path tools
Konling SHALL expose scoped tools for adaptive learning path generation, revision, selection, rejection, explanation, and outcome recording.

#### Scenario: Student requests a generated path
- **WHEN** a student asks Konling to generate a learning path from the adaptive path center
- **THEN** Konling SHALL call a governed path-generation tool using server-owned learner, route, goal, class/course, and privacy context
- **AND** the tool SHALL return structured path options suitable for page rendering.

#### Scenario: Student revises generated options
- **WHEN** a student asks for a different time budget, difficulty rhythm, resource preference, checkpoint density, external-resource permission, or goal description
- **THEN** Konling SHALL call a governed revision tool
- **AND** the new options SHALL preserve the prior request and evidence chain.

#### Scenario: Student selects or rejects an option
- **WHEN** a student selects, rejects, switches, or marks a path option useful or not useful
- **THEN** Konling SHALL record the outcome as governed path activity
- **AND** selection alone SHALL NOT be treated as mastery evidence.

### Requirement: Path tools are auditable and idempotent
Konling path-generation tools SHALL use the shared AgentToolRun audit and idempotency contract.

#### Scenario: Tool call starts
- **WHEN** Konling accepts a path-generation, revision, selection, or rejection tool call
- **THEN** the system SHALL persist tool name, agent session, actor user, target user, goal, permission tier, approval state, correlation id, idempotency key, and redacted input summary before executing side effects.

#### Scenario: Student path-center tool does not require approval
- **WHEN** a student requests a path generation, revision, selection, rejection, explanation, or adjustment-outcome tool from the adaptive path center
- **THEN** Konling MAY record the AgentToolRun approval state as not-required
- **AND** the tool SHALL still enforce authenticated or target student scope, registered goal scope, class scope where available, course-scoped AgentSession and ToolRun context, privacy scope, AgentSession permitted tools, idempotency, and redacted input summary before any side effect
- **AND** path-bound revision, selection, rejection, explanation, or adjustment tools SHALL verify the requested path belongs to the scoped student, registered goal, and class scope where available before any path-bound side effect.

#### Scenario: Idempotent request repeats
- **WHEN** the same owner user repeats the same path-generation request with the same idempotency key
- **THEN** the system SHALL reuse or return the existing tool run according to registry policy
- **AND** it SHALL NOT create duplicate active path rounds.

### Requirement: Konling path outputs use student-safe language
Konling path generation SHALL return student-facing explanations without leaking internal readiness codes.

#### Scenario: Planner has low evidence
- **WHEN** a generated path uses low-confidence or starter-path logic
- **THEN** Konling SHALL explain the limitation in student language
- **AND** raw values such as `missing-*`, `low-evidence`, `no-path`, `stage`, or `policyFamily` SHALL NOT appear in student-visible text.

## MODIFIED Requirements

### Requirement: Konling exposes adaptive-learning tools
Konling SHALL expose tools for page, learner, plan, memory, knowledge graph, next action, simulation status, intervention, attempt analysis, and adaptive path generation.

#### Scenario: Default tools are available
- **WHEN** Konling handles a learning-support conversation on the adaptive path center
- **THEN** it SHALL be able to call the governed adaptive path tools permitted by the authenticated role and route context
- **AND** each tool SHALL enforce user, class, resource, path, goal, and privacy scope.
