## ADDED Requirements

### Requirement: Path journey navigation is server-owned
Adaptive path execution SHALL provide an authorized journey navigation view derived from persisted path state, readiness, completion, deviation, and required result bindings.

#### Scenario: Target resource reads journey state
- **WHEN** a supported resource receives a valid path launch context
- **THEN** it SHALL be able to read a journey view containing the owning path, current node, progress, return target, path status, and next-action state
- **AND** path ownership and node membership SHALL be verified before any path or next-node details are returned.

#### Scenario: Client requests an unauthorized path
- **WHEN** a client presents a path launch context for a path or node it cannot access
- **THEN** the system SHALL reject the journey read without disclosing path structure or next-node targets.

### Requirement: Completion responses expose recomputed continuation
Path execution completion SHALL return continuation state only after the server has recorded evidence, rebound governed results, refreshed readiness, and updated the current node.

#### Scenario: Completion unlocks the next node
- **WHEN** accepted completion evidence satisfies the current node and its dependent readiness gates
- **THEN** the completion response SHALL contain a `ready` next action with stable node identity, student-facing title, resource type, and path-aware target
- **AND** the client SHALL NOT derive that target from visible order or stale path payload.

#### Scenario: Complex result is not yet bound
- **WHEN** completion requires an assessment, simulation, workbench, or Arena result that is missing or still pending
- **THEN** the continuation state SHALL be `pending-result` or `blocked` with a student-facing reason and recovery action
- **AND** no navigable next target SHALL be returned.

#### Scenario: Completion request is replayed
- **WHEN** an idempotent completion write is replayed
- **THEN** the response SHALL return the current authoritative journey state
- **AND** it SHALL NOT advance the path or count completion twice.

### Requirement: Path context survives the complete resource journey
Governed `interactive_lesson`, `knowledge_card`, `textbook_section`, `slides`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `external_resource`, `reflection`, `checkpoint`, and `konling` path nodes SHALL preserve normalized path context through their registered platform-owned target, owning path-center activity, or governed external fallback.

#### Scenario: Resource uses an intermediate detail page
- **WHEN** a path target opens a detail page before its execution workspace
- **THEN** the detail page SHALL preserve the path launch context in its primary execution link
- **AND** both the detail page and execution workspace SHALL retain the same path return target and node identity.

#### Scenario: Non-path entry opens the same resource
- **WHEN** the resource is opened without a valid path launch context
- **THEN** it SHALL retain its normal navigation and completion behavior
- **AND** it SHALL NOT expose path progress or a fabricated next action.

#### Scenario: Planner admits a new internal node type
- **WHEN** a new platform-owned node type becomes path-plannable
- **THEN** its registry contract SHALL identify a platform destination or path-center owner that implements journey read, return, completion, and continuation behavior
- **AND** the planner SHALL keep it out of executable paths until that behavior is auditable.

#### Scenario: Planner admits an external resource
- **WHEN** an external resource is path-plannable but cannot consume platform path controls
- **THEN** its execution contract SHALL keep the path center available, record governed access and completion state, and refresh the authoritative journey on return
- **AND** it SHALL NOT require the student to restart the same node to reach the next action.
