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

### Requirement: Konling exposes persisted simulation tools
Konling SHALL expose simulation tools that operate on canonical SimulationRun and SimulationTrace records rather than process-global simulation state.

#### Scenario: Simulation context is requested
- **WHEN** Konling calls `get_simulation_context`
- **THEN** the tool SHALL resolve the requested SimulationRun or SimulationTaskSpec within the authenticated user's permitted scope
- **AND** it SHALL return compact task, controller, summary, replay, provenance, and evidence-status fields.

#### Scenario: Virtual simulation is run
- **WHEN** Konling calls `run_virtual_simulation`
- **THEN** the tool SHALL create or resolve an idempotent SimulationRun through the simulation orchestration boundary
- **AND** it SHALL record the associated AgentToolRun with owner user, correlation id, and idempotency key.

### Requirement: Konling analyzes and compares simulation traces
Konling SHALL support trace analysis and run comparison through scoped tools that use persisted summaries, trace references, and analyzer outputs.

#### Scenario: Trace is analyzed
- **WHEN** Konling calls `analyze_simulation_trace`
- **THEN** the tool SHALL verify run ownership or authorized teacher scope before reading summary or trace metadata
- **AND** it SHALL return analyzer results without exposing raw high-frequency samples by default.

#### Scenario: Runs are compared
- **WHEN** Konling calls `compare_simulation_runs`
- **THEN** each compared run SHALL be within the same authorized owner or class scope
- **AND** the output SHALL preserve run kind, preview/official provenance, replay state, and low-confidence markers.

### Requirement: Controller patch application requires approval
Konling SHALL separate controller patch proposal from controller patch application and require approval for application.

#### Scenario: Patch is proposed
- **WHEN** Konling calls `propose_controller_patch`
- **THEN** the tool SHALL return a candidate patch, rationale, affected controller fields, expected tradeoffs, and evidence references
- **AND** it SHALL NOT mutate controller state.

#### Scenario: Patch is applied
- **WHEN** Konling calls `apply_controller_patch`
- **THEN** the tool SHALL create an approval-required AgentToolRun
- **AND** it SHALL apply the patch only after approval and only within the owner user's scoped controller draft.

### Requirement: Konling coaching is path-aware and citation-enforced
Konling SHALL provide control-correction coaching from server-owned path context and SHALL attach required citations to coaching claims.

#### Scenario: Control-correction coaching starts
- **WHEN** Konling handles a message in a control-correction learning path context
- **THEN** it SHALL load server-owned page context, learner-state slice, active path round, current node, recent evidence, memory summaries, permitted tools, and citation requirements
- **AND** client-provided page hints SHALL NOT expand user, class, resource, path, or privacy scope.

#### Scenario: Personalized recommendation is generated
- **WHEN** Konling recommends a next action, fallback path, readiness decision, or correction step
- **THEN** the response SHALL include at least one content citation and at least one learner, path, execution, simulation, Arena, or intervention evidence citation where available
- **AND** missing or low-confidence evidence SHALL be disclosed as a limitation.

#### Scenario: Simulation or Arena failure is analyzed
- **WHEN** Konling analyzes a simulation failure or Arena submission issue
- **THEN** it SHALL cite the relevant run, summary, replay, official submission, or governed evidence reference plus an instructional content reference
- **AND** it SHALL NOT expose hidden official evaluation internals, raw high-frequency traces, or private memory payloads by default.

#### Scenario: Intervention outcome is captured
- **WHEN** a student accepts, ignores, rejects, or partially accepts a Konling control-correction intervention
- **THEN** the runtime SHALL persist the outcome with path id, node id, evidence references, privacy-safe summary, and confidence state
- **AND** the outcome SHALL be available to governed evidence or feature-cache refresh.

### Requirement: Konling corrects failed validation from governed evidence
Konling SHALL use governed simulation and Arena validation summaries when coaching a student after failed control-correction terminal validation.

#### Scenario: Validation failure triggers coaching
- **WHEN** a control-correction path records failed or low-confidence terminal validation
- **THEN** Konling SHALL be able to analyze the failure from authorized validation summaries, learner-state slice, path context, and instructional citations
- **AND** it SHALL propose a fallback or correction step without exposing hidden Arena internals, raw traces, or private memory.

#### Scenario: Evidence is insufficient for diagnosis
- **WHEN** validation evidence is missing, stale, preview-only, or low-confidence
- **THEN** Konling SHALL present the diagnosis as tentative
- **AND** it SHALL recommend evidence-gathering or fallback actions instead of claiming verified causality.

### Requirement: Konling supports teaching-assistant modes
Teaching-assistant modes SHALL expose route-level readiness for the competition assistant workflow.

#### Scenario: Assistant mode readiness is requested
- **WHEN** diagnosis explainer, path advisor, grading assistant, feedback explainer, class summarizer, or prep coauthor mode is mounted on a supported route
- **THEN** the runtime SHALL return `ready`, `degraded`, or `unavailable`
- **AND** unavailable states SHALL include missing required context, unsupported role, missing citation class, or unknown mode reasons.

#### Scenario: Required context is present
- **WHEN** a mode has its required server-owned context and citation classes
- **THEN** the mode SHALL expose permitted tools and safe scope metadata
- **AND** client-supplied hints SHALL NOT override server-verifiable permissions or target identity.

### Requirement: Mode fallback is explicit
Mode fallback SHALL be user-visible and testable.

#### Scenario: Required mode context is unavailable
- **WHEN** a teaching-assistant mode lacks required context or citations
- **THEN** the mode SHALL be unavailable or degraded with a clear reason
- **AND** it SHALL NOT generate authoritative recommendations from generic chat context alone.
