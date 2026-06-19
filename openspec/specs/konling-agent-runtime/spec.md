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
Konling SHALL expose tools for page, learner, plan, memory, knowledge graph, next action, simulation status, intervention, attempt analysis, and adaptive path generation.

#### Scenario: Default tools are available
- **WHEN** Konling handles a learning-support conversation on the adaptive path center
- **THEN** it SHALL be able to call the governed adaptive path tools permitted by the authenticated role and route context
- **AND** each tool SHALL enforce user, class, resource, path, goal, and privacy scope.

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

#### Scenario: Student-owned adaptive path tool is requested
- **WHEN** a student requests an adaptive path generation, revision, selection, rejection, or adjustment-outcome tool from the adaptive path center
- **THEN** Konling MAY mark the tool run approval state as not-required
- **AND** the tool SHALL remain bound to the authenticated or target student, registered path goal, class scope where available, course-scoped AgentSession and ToolRun context, privacy scope, AgentSession permitted tools, idempotency key, and redacted input summary
- **AND** path-bound selection, rejection, revision, explanation, or adjustment tools SHALL verify the requested path belongs to the scoped student, registered goal, and class scope where available before side effects.

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
Konling SHALL provide control-correction coaching from server-owned path context, consume path comparison, selection history, and terminal validation context, and attach required citations to coaching claims.

#### Scenario: Control-correction coaching starts
- **WHEN** Konling handles a message in a control-correction learning path context
- **THEN** it SHALL load server-owned page context, learner-state slice, active path round, current node, recent evidence, memory summaries, permitted tools, and citation requirements
- **AND** client-provided page hints SHALL NOT expand user, class, resource, path, or privacy scope.

#### Scenario: Personalized recommendation is generated
- **WHEN** a student asks why a path is recommended or selected
- **THEN** Konling SHALL ground the answer in diagnosis, path option context, selection history, and evidence citations
- **AND** the response SHALL include at least one content citation and at least one learner, path, execution, simulation, Arena, or intervention evidence citation where available
- **AND** missing or low-confidence evidence SHALL be disclosed as a limitation
- **AND** it SHALL distinguish preference evidence from mastery evidence.

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
Teaching-assistant modes SHALL expose route-level readiness for the competition assistant workflow, and prep coauthor mode SHALL remain advisory during prep-pack review.

#### Scenario: Assistant mode readiness is requested
- **WHEN** diagnosis explainer, path advisor, grading assistant, feedback explainer, class summarizer, or prep coauthor mode is mounted on a supported route
- **THEN** the runtime SHALL return `ready`, `degraded`, or `unavailable`
- **AND** unavailable states SHALL include missing required context, unsupported role, missing citation class, or unknown mode reasons.

#### Scenario: Diagnosis explainer mode starts
- **WHEN** Konling opens from a learning diagnosis surface
- **THEN** it SHALL load the server-owned diagnosis view, learner-state summary, relevant evidence citations, permitted tools, and missing-context state.

#### Scenario: Required context is present
- **WHEN** a mode has its required server-owned context and citation classes
- **THEN** the mode SHALL expose permitted tools and safe scope metadata
- **AND** client-supplied hints SHALL NOT override server-verifiable permissions or target identity.

#### Scenario: Grading assistant prepares write-capable output
- **WHEN** the grading assistant prepares feedback, score changes, or diagnosis-affecting output
- **THEN** generated output SHALL remain a draft until the grading workflow records an explicit approval action
- **AND** the runtime SHALL NOT approve grading, write back profiles, or mutate governed evidence from assistant context alone.

#### Scenario: Grading assistant mode starts
- **WHEN** Konling opens from a teacher grading workbench
- **THEN** it SHALL load rubric, converted document references, draft grading state, teacher review state, citation requirements, and role-scoped permissions
- **AND** it SHALL NOT approve grading or write back profiles without the grading workflow approval action.

#### Scenario: Prep coauthor proposes lesson material
- **WHEN** the prep coauthor generates insertion candidates, replacement text, or prep-pack updates
- **THEN** generated suggestions SHALL remain drafts until the authorized teacher approves them
- **AND** the runtime SHALL NOT insert, publish, or replace prep-pack material from client hints or assistant output alone.

#### Scenario: Prep coauthor mode starts
- **WHEN** a teacher opens prep coauthor mode from a prep-pack review surface
- **THEN** Konling SHALL receive prep-pack, diagnosis, citation, and teacher-review context
- **AND** generated suggestions SHALL remain drafts until teacher approval
- **AND** it SHALL be forbidden from publishing prep items or inserting lesson items directly.

### Requirement: Mode fallback is explicit
Mode fallback SHALL be user-visible and testable.

#### Scenario: Required mode context is unavailable
- **WHEN** a teaching-assistant mode lacks required context or citations
- **THEN** the mode SHALL be unavailable or degraded with a clear reason
- **AND** mode dependencies including diagnosis, path, grading, prep-pack, or citation context SHALL be represented in that unavailable or degraded state
- **AND** it SHALL NOT generate authoritative recommendations from generic chat context alone.

### Requirement: Konling receives simulation page context from server-owned sources
Konling SHALL load simulation page context from server-owned route, run, task, learner, and permission sources.

#### Scenario: Konling opens on simulation detail page
- **WHEN** Konling starts on a `/simulations/*` route
- **THEN** it SHALL resolve simulation id, route provenance, available run summary, task context, learner scope, and permitted tools from server-owned context
- **AND** client-provided page hints SHALL NOT expand user, class, resource, path, simulation, or privacy scope.

### Requirement: Simulation assistant fallback is explicit
Konling SHALL expose degraded or unavailable state when simulation context required for coaching is missing.

#### Scenario: Simulation context is incomplete
- **WHEN** Konling lacks required simulation run, task, or learner context
- **THEN** it SHALL present a degraded or unavailable state with a clear reason
- **AND** it SHALL NOT claim authoritative diagnosis from generic chat context alone.

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

### Requirement: Konling receives knowledge workspace context from governed sources
Konling SHALL resolve knowledge graph context from server-owned user, route, resource, evidence, and permission sources, supplemented by scoped client selection hints.

#### Scenario: Konling opens with a selected knowledge node
- **WHEN** Konling starts on `/knowledge` and a graph node is selected
- **THEN** it SHALL receive the knowledge route, selected node id, selected node name, node type, chapter context, relation summary, active filters, density mode, view mode, and available learning actions where permitted
- **AND** learner identity, evidence access, resource access, and tool permissions SHALL remain server-owned.

#### Scenario: Client hints are broader than permission scope
- **WHEN** a client graph hint references a resource, evidence item, class, path, or selected node outside the user's permitted scope
- **THEN** Konling SHALL ignore or degrade that context
- **AND** it SHALL NOT expand the user's accessible evidence, resources, tools, or privacy scope.

### Requirement: Knowledge assistant fallback is explicit
Konling SHALL expose route-level or degraded guidance when selected-node or learner context is missing.

#### Scenario: No knowledge node is selected
- **WHEN** Konling opens on `/knowledge` without a selected node
- **THEN** it SHALL provide route-level graph exploration guidance
- **AND** it SHALL NOT claim selected-node diagnosis or evidence analysis.

#### Scenario: Selected-node context is incomplete
- **WHEN** Konling cannot resolve required selected-node, resource, or evidence context
- **THEN** it SHALL present a degraded or unavailable state with a clear reason
- **AND** it SHALL NOT infer authoritative learning advice from generic chat context alone.

### Requirement: Konling path generation uses panel parameters
Konling path-advisor tools SHALL consume the generation panel's structured parameters when assisting path generation or revision.

#### Scenario: Student asks Konling to adjust a path
- **WHEN** the student uses `请控灵调整` from the generation panel or option comparison view
- **THEN** Konling SHALL call the governed path tool with the current form parameters and sanitized natural-language intent
- **AND** it SHALL NOT replace the panel with a generic chat-only workflow.

#### Scenario: Textarea input is provided
- **WHEN** the student types natural-language intent in the panel textarea
- **THEN** the content SHALL be included as a redacted intent summary for the path tool
- **AND** the textarea SHALL be editable in the UI.

### Requirement: Konling grounds answers in knowledge and capability context
Konling SHALL ground supported teaching-assistant answers in server-owned knowledge node, capability target, resource, learner, path, and citation context where available.

#### Scenario: Concept explanation is requested
- **WHEN** a student asks for a factual course concept explanation
- **THEN** Konling SHALL identify relevant knowledge nodes or resource context where available
- **AND** the answer SHALL prioritize verified teaching knowledge citations over learner evidence unless it makes a personalized claim.

#### Scenario: Personalized path advice is requested
- **WHEN** a student asks why a path, node, or resource is recommended
- **THEN** Konling SHALL ground the answer in capability targets, ResourceNode or PlanningUnit rationale, selected path context, and authorized learner evidence where available
- **AND** missing citation classes or low-confidence evidence SHALL be disclosed as limitations.

#### Scenario: Grading or mastery-impacting advice is generated
- **WHEN** Konling generates grading explanation, mastery advice, or diagnosis-affecting output
- **THEN** generated text SHALL remain explanatory unless a governed tool run, approved grading workflow, or materialized evidence summary records the outcome
- **AND** raw assistant narrative SHALL NOT directly update learner mastery.
