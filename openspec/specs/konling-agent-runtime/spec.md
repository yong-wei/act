## Purpose

Define the state-aware Konling runtime that loads server-owned adaptive context, exposes scoped learning tools, persists governed memory, and records corrective or remedial intervention outcomes.
## Requirements
### Requirement: Konling reads server-owned adaptive context
Konling SHALL build runtime context from server-owned page context, learner state, plan context, and scoped memory rather than default or client-provided profile values.

#### Scenario: Konling context is loaded
- **WHEN** Konling starts or receives a message on a supported page
- **THEN** it SHALL load page context, learner state, current plan context, recent evidence, relevant memory summaries, and permitted tools
- **AND** missing or low-confidence context SHALL be visible to prompt construction and response rationale.

### Requirement: Konling exposes adaptive-learning tools
Konling SHALL expose tools for page, learner, plan, memory, knowledge graph, next action, simulation status, intervention, and attempt analysis.

#### Scenario: Default tools are available
- **WHEN** Konling handles a learning-support conversation
- **THEN** it SHALL be able to call `get_page_context`, `get_learner_state`, `get_plan_context`, `search_learning_memory`, `search_knowledge_graph`, `recommend_next_action`, `get_simulation_status`, `record_intervention_result`, and `analyze_attempt`
- **AND** each tool SHALL enforce user, class, resource, path, and privacy scope.

### Requirement: Konling memory is staged and scoped
Konling SHALL persist Stage 1 memory at working-summary, session-summary, episodic, and intervention-outcome levels.

#### Scenario: Conversation creates memory summary
- **WHEN** a Konling conversation produces durable learning insight, repeated confusion, preference, or intervention outcome
- **THEN** the system SHALL persist a privacy-scoped memory summary
- **AND** raw dialogue text SHALL NOT be required in learner-state or teacher-facing payloads.

#### Scenario: Long-term memory is not yet enabled
- **WHEN** Stage 1 Konling runtime is active
- **THEN** semantic learner memory and strategy memory SHALL remain feature-flagged or disabled
- **AND** enabling them later SHALL require privacy audit coverage, evaluation metrics, and persisted intervention outcomes.

### Requirement: Konling interventions are governed
Konling SHALL support corrective and remedial interventions grounded in learner state and path context.

#### Scenario: Intervention is generated
- **WHEN** Konling intervenes because of risk, stagnation, path deviation, or repeated failure
- **THEN** the intervention SHALL explain why now, which evidence supports it, and what alternatives exist
- **AND** it SHALL respect cooldowns, teacher policy, privacy scope, and student feedback history.

#### Scenario: Intervention outcome is recorded
- **WHEN** a student accepts, dismisses, or rates an intervention
- **THEN** the system SHALL persist the outcome
- **AND** the outcome SHALL be available to learner state and path evaluation within privacy limits.

### Requirement: Konling maintains stateful agent sessions
Konling SHALL maintain task-oriented agent sessions that are separate from short chat history and scoped to the owning user.

#### Scenario: Agent session is created
- **WHEN** Konling starts a task-oriented workflow
- **THEN** the system SHALL create or resolve an agent session with owner user, course, page, class, resource, path, phase, status, and expiration metadata
- **AND** the session SHALL NOT be readable or resumable by a different student.

#### Scenario: Agent session is resumed
- **WHEN** the owner user resumes a paused or awaiting-approval agent session
- **THEN** Konling SHALL restore server-owned context, last workflow state, permitted tools, and pending approval state before continuing.

### Requirement: Konling tool registry governs permission tiers
Konling SHALL register tools through a server-owned registry that declares permission tier, scope requirements, approval policy, idempotency policy, and redaction policy.

#### Scenario: Tool set is built
- **WHEN** Konling builds tools for a runtime context
- **THEN** it SHALL expose only tools permitted by the authenticated role, owner user scope, class scope, course scope, resource scope, path scope, and privacy scope
- **AND** client-provided page hints SHALL NOT expand the server-owned tool set.

#### Scenario: State-changing tool is requested
- **WHEN** a write or publish tier tool is requested
- **THEN** the tool call SHALL enter an approval-required state unless a future spec defines a narrower approved exception.

### Requirement: Konling persists auditable tool runs
Konling SHALL persist every tool call as an auditable tool-run record before executing side effects.

#### Scenario: Tool call starts
- **WHEN** a tool call is accepted by the registry
- **THEN** the system SHALL record tool name, agent session, actor user, target user, permission tier, approval state, status, correlation id, idempotency key, and redacted input summary.

#### Scenario: Tool call completes
- **WHEN** a tool call succeeds or fails
- **THEN** the system SHALL record status, completion time, redacted output or error summary, and latency metadata.

#### Scenario: Idempotent request repeats
- **WHEN** the same owner user repeats a tool call with the same tool name and idempotency key
- **THEN** the system SHALL reuse, reject, or return the existing tool run according to the registry idempotency policy
- **AND** it SHALL NOT perform duplicate side effects.

### Requirement: Konling long-term memory is user-isolated
Konling SHALL keep long-term memory isolated by owner user and scoped by course, class, scene, resource, path, privacy, evidence references, and TTL policy where applicable.

#### Scenario: Memory is retrieved
- **WHEN** Konling retrieves long-term memory
- **THEN** the query SHALL filter by owner user and permitted scope before returning any memory summary
- **AND** it SHALL NOT return another student's memory even if the course, scene, or class matches.

#### Scenario: Memory is written
- **WHEN** Konling writes durable memory
- **THEN** the memory SHALL include owner user, privacy scope, TTL policy, and evidence references
- **AND** raw private dialogue SHALL NOT be required in teacher-facing or learner-state payloads.
