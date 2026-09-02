## Purpose

Define the state-aware Konling runtime that loads server-owned adaptive context, exposes scoped learning tools, persists governed memory, and records corrective or remedial intervention outcomes.
## Requirements
### Requirement: Konling reads server-owned adaptive context
Konling SHALL build runtime context from server-owned page context, learner state, plan context, graph context, and scoped memory rather than default or client-provided profile values. Konling MUST resolve the current Authority/Teaching Projection combination on the server and MAY include `authorityReleaseId`, `projectionId`, scoped Canonical IDs, linked teaching resources, prerequisite ancestors/successors, and optional card metadata. Client-supplied IDs MUST be revalidated and MUST NOT select another learner's or course's projection.

#### Scenario: Graph-aware Konling context is loaded
- **WHEN** Konling starts or receives a message on a graph-aware path, graph-center, diagnosis, or prep-pack surface
- **THEN** it SHALL load the available Konling graph context in addition to page context, learner state, current plan context, recent evidence, memory summaries, and permitted tools
- **AND** missing graph context classes SHALL be visible to prompt construction, tool input preparation, and response rationale.

#### Scenario: Course context is valid
- **WHEN** an authenticated learner asks within a current lesson scope
- **THEN** Konling SHALL carry the server-resolved Authority/Projection identities and scoped resources
- **AND** the context SHALL include only permitted prerequisite/card metadata

#### Scenario: Projection is unavailable
- **WHEN** the requested Teaching Projection is missing, stale, or unauthorized
- **THEN** Konling SHALL return explicit unavailable or Legacy/pinned fallback status
- **AND** it SHALL not infer teaching resources from raw ActKG labels

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
Konling SHALL provide graph-aware path coaching from server-owned path and graph context, consume path comparison, selection history, terminal validation context, and graph grounding, and attach required citations to coaching claims.

#### Scenario: Personalized graph path explanation is generated
- **WHEN** a student asks why a graph-driven path or node was recommended
- **THEN** Konling SHALL ground the answer in LearningGoal metadata, ExpandedGoalSubgraph, authorized learner or class overlay, ResourceCoverage, path option context, selection history, and verified citations where available
- **AND** it SHALL disclose missing or low-confidence goal, graph, resource, overlay, path, version, or citation context as a limitation.

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
Teaching-assistant modes SHALL expose route-level readiness for the competition assistant workflow, and prep coauthor mode SHALL remain advisory during prep-pack review and smart lesson preparation.

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
- **WHEN** the prep coauthor generates insertion candidates, replacement text, prep-pack updates, or smart-preparation task changes
- **THEN** generated suggestions SHALL remain drafts until the authorized teacher approves them
- **AND** the runtime SHALL NOT insert, publish, replace, or confirm teaching content from client hints or assistant output alone.

#### Scenario: Prep coauthor mode starts from prep-pack review
- **WHEN** a teacher opens prep coauthor mode from a prep-pack review surface
- **THEN** Konling SHALL receive prep-pack, diagnosis, citation, and teacher-review context
- **AND** generated suggestions SHALL remain drafts until teacher approval
- **AND** it SHALL be forbidden from publishing prep items or inserting lesson items directly.

#### Scenario: Prep coauthor mode starts from smart preparation
- **WHEN** a teacher opens prep coauthor mode from `/teacher/smart-prep`
- **THEN** Konling SHALL receive the server-owned smart-task revision, selected course-basis versions, unresolved ambiguities, confirmed decisions, citation state, and teacher-review state
- **AND** session history SHALL remain bound to the owning teacher and exact smart task
- **AND** proposed task changes SHALL require explicit teacher confirmation through the smart-preparation workflow.

#### Scenario: Smart-preparation ambiguity remains unresolved
- **WHEN** prep coauthor mode cannot resolve a required smart-task field to one authorized value
- **THEN** it SHALL expose a clarification turn and structured alternatives
- **AND** it SHALL NOT invoke lesson-plan generation until the teacher confirms one result.

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
Konling SHALL ground supported teaching-assistant answers in server-owned knowledge node, capability target, resource, learner, path, and citation context where available. Knowledge answers MUST distinguish Engineering Authority facts from Teaching Resource evidence and retain domain, Authority, Projection, Canonical, resource, and citation identities. Teaching prerequisites MUST NOT be written back to ActKG through answer generation or tool calls.

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

#### Scenario: Engineering and teaching sources are composed
- **WHEN** a response uses both engineering relations and a course handout/card
- **THEN** the answer metadata SHALL retain separate domain provenance and citations
- **AND** no cross-domain teaching edge SHALL be persisted

#### Scenario: Optional card is absent
- **WHEN** a Canonical ID has no active optional card
- **THEN** Konling MAY use node summary or other projected resource evidence
- **AND** it SHALL not claim that the Canonical node is absent

### Requirement: Konling path-advisor entrypoints follow registered LearningGoals
Konling SHALL expose adaptive path-advisor entrypoints for every registered `path-ready` LearningGoal that the adaptive path center can display.

#### Scenario: Student opens a registered goal path center
- **WHEN** an authenticated student opens `/assessment/adaptive-practice?goal=<goal-id>` for any registered `path-ready` LearningGoal
- **THEN** Konling SHALL receive a server-owned `path-advisor` context for that LearningGoal
- **AND** the context SHALL include the LearningGoal id, title, goal-specific topic, learning objectives, class scope, page id, and mode context token.

#### Scenario: Goal-specific quick prompts are shown
- **WHEN** Konling path-advisor quick prompts are built for a registered LearningGoal
- **THEN** the prompts SHALL name the active LearningGoal and its student-facing purpose
- **AND** they SHALL NOT be hard-coded to control-correction or frequency-response copy unless that is the active LearningGoal.

#### Scenario: LearningGoal context is incomplete
- **WHEN** a registered LearningGoal lacks metadata needed for path-advisor title, topic, objectives, quick prompts, or graph grounding
- **THEN** catalog or Konling entrypoint contract tests SHALL fail before the change can pass
- **AND** Konling SHALL NOT present generic advice as if it were grounded in a specific LearningGoal.

#### Scenario: Unknown goal requests path advisor
- **WHEN** a client requests path-advisor context for an unknown LearningGoal id
- **THEN** Konling SHALL reject the request through the governed registered-goal error path
- **AND** it SHALL NOT mint a mode context token for the unknown goal.

### Requirement: Konling streaming citation diagnostics are environment-gated
Konling SHALL separate user-visible streaming answer text from citation-guard debugging diagnostics.

#### Scenario: Development diagnostic injection is enabled
- **WHEN** Konling streams an answer in development and citation-debug injection is enabled
- **THEN** the runtime MAY inject complete citation guard diagnostics into the stream for debugging
- **AND** the visible notice SHALL explicitly identify itself as development-mode diagnostics.

#### Scenario: Production diagnostic injection is disabled
- **WHEN** Konling streams an answer in production and citation-debug injection is not explicitly enabled
- **THEN** the runtime SHALL NOT inject raw citation guard diagnostics into user-visible answer text
- **AND** raw tokens such as `assistant-citations-unverified-stream`, `missing-learner-state`, and `missing-path-execution` SHALL remain outside the visible assistant message.

#### Scenario: Citation diagnostics are persisted
- **WHEN** a Konling answer is generated
- **THEN** the runtime SHALL persist citation guard status, missing citation classes, low-confidence reasons, retrieval source summaries, and personalization availability metadata with the conversation or agent session
- **AND** production visibility of diagnostics SHALL be controlled by environment configuration rather than removing diagnostic persistence.

### Requirement: Konling citation requirements follow answer intent
Konling SHALL determine required citation classes from the answer intent and the claims made by the response.

#### Scenario: Concept explanation has content citations
- **WHEN** a user asks for a course concept explanation from graph center or another content-grounded surface
- **THEN** Konling SHALL generate a cited answer when authorized content, graph, textbook, handout, or knowledge-card citations are available
- **AND** missing learner-state or path-execution data SHALL NOT by itself make the content citation guard fail.

#### Scenario: Personalized answer lacks learner data
- **WHEN** a user asks for personalized diagnosis, path advice, remediation, grading explanation, report explanation, or intervention advice and learner-state or path-execution data is missing
- **THEN** Konling SHALL still return a cited answer from available teaching content and retrieval sources where possible
- **AND** it SHALL mark personalization as limited instead of fabricating learner-specific claims.

#### Scenario: Personalized answer uses learner data
- **WHEN** authorized learner-state, path-execution, or evidence citations are available and the answer makes personalized claims
- **THEN** Konling SHALL use those citations to shape answer scope, style, emphasis, and recommendations
- **AND** the response metadata SHALL distinguish available personalization evidence from general content citations.

#### Scenario: Content citations are unavailable
- **WHEN** no authorized content or retrieval citation is available for a content-grounded claim
- **THEN** Konling SHALL block, redact, downgrade, or provide a user-safe limitation
- **AND** it SHALL NOT treat missing learner-state data as a substitute for missing content evidence.

### Requirement: Konling visible limitations are user-safe
Konling SHALL translate internal citation and personalization limitations into student-safe explanations when a visible limitation is needed.

#### Scenario: Visible limitation is needed
- **WHEN** a response must disclose limited personalization or citation confidence to a student
- **THEN** the visible text SHALL describe the limitation in product language such as insufficient personal learning record or limited path history
- **AND** it SHALL NOT expose raw field names, debug tokens, provider diagnostics, hidden context ids, or audit-only reason codes.

### Requirement: Konling degrades personalization without blocking cited replies
Konling SHALL use learner-state and path-execution data when available, but missing personalization data SHALL not prevent content-grounded cited answers.

#### Scenario: Learner-state is available
- **WHEN** Konling answers a student and the Learner State Service returns authorized learner-state data
- **THEN** Konling SHALL use that data to shape answer scope, style, emphasis, and personalized recommendations
- **AND** learner-state citation metadata SHALL be available to the response guard.

#### Scenario: Learner-state is missing
- **WHEN** Konling answers a student and learner-state data is sparse, missing, or low confidence
- **THEN** Konling SHALL still generate a response with verified teaching-content citations when content citations are available
- **AND** the response SHALL mark personalization as limited rather than failing retrieval.

#### Scenario: Path execution is missing
- **WHEN** Konling answers outside an active path execution context or the learner has no path execution records
- **THEN** Konling SHALL not require path-execution citations for ordinary concept explanations
- **AND** path advice or personalized recommendation responses SHALL disclose the missing path-execution context as a personalization limitation.

#### Scenario: Production learner-state service is disabled
- **WHEN** production Konling detects that the learner-state service flag is disabled
- **THEN** the runtime SHALL record an operational missing-context diagnostic
- **AND** it SHALL still answer with available teaching-content citations where possible instead of treating the disabled flag as a content citation failure.

### Requirement: Konling renders verified citations from server-owned metadata
Konling SHALL present answer citations from server-owned citation metadata rather than model-authored Markdown footnotes.

#### Scenario: Final assistant message includes citation metadata
- **WHEN** a Konling assistant message includes `konlingCitationGuard`, Source Pack citations, or CitationChip payloads
- **THEN** the UI SHALL render citations from normalized server-owned metadata with display title, source type, confidence, citation-level limitation state, and click target
- **AND** model-authored Markdown footnotes SHALL NOT be treated as verified citations.

#### Scenario: Citation metadata is limited or unavailable
- **WHEN** a citation has missing, restricted, stale, low-confidence, or unavailable address metadata
- **THEN** the UI SHALL present the citation as limited or unavailable with a safe label
- **AND** it SHALL NOT navigate to a meaningless page anchor or present the citation as fully verified.

#### Scenario: Citation presentation is normalized before rendering
- **WHEN** raw Konling guard metadata, Source Pack items, knowledge node citations, path-execution evidence, learner-state evidence, simulation evidence, or Arena evidence are available for a final assistant message
- **THEN** the system SHALL normalize them into a deterministic citation presentation model before any chat UI renders the message
- **AND** each normalized item SHALL include a stable key, display index, title, source type, confidence, citation-level limitation state, safe href when available, and evidence basis metadata.

#### Scenario: Verified content citations coexist with limited personalization
- **WHEN** a final answer has high-confidence or medium-confidence teaching-content citations with safe server-owned targets
- **AND** learner-state, path-execution, or personalization evidence is missing or limited
- **THEN** the teaching-content citations SHALL remain clickable
- **AND** the final answer summary MAY disclose limited personalization without globally disabling unrelated verified content citations.

#### Scenario: Citations are deduplicated by governed source identity
- **WHEN** multiple raw citation entries point to the same governed source, retrieval chunk, citation target, knowledge node, textbook section, path execution evidence, learner-state evidence, simulation trace, or Arena evidence
- **THEN** the normalized citation presentation SHALL deduplicate entries using type-aware stable keys before assigning display numbers
- **AND** it SHALL NOT merge citations across different source types only because their titles match.

### Requirement: Konling assistant prose suppresses fake citation footnotes
Konling SHALL prevent model-authored GFM footnotes and generated `#user-content-fn*` anchors from appearing as platform citations.

#### Scenario: Model emits duplicate Markdown footnotes
- **WHEN** model prose contains repeated GFM footnotes such as duplicate `[1]` references or `[^content]` definitions
- **THEN** the message renderer SHALL strip, disable, or normalize those footnotes so they are not displayed as verified citations
- **AND** verified citation numbering SHALL be derived only from server-owned citation metadata.

#### Scenario: Model emits current-page footnote anchors
- **WHEN** model prose contains current-page footnote anchors such as `#user-content-fn-content` or `#user-content-fnref-content`
- **THEN** those links SHALL NOT be rendered as clickable verified citation links
- **AND** normalized citation links SHALL use only safe server-owned citation targets.

### Requirement: Konling distinguishes streaming diagnostics from final citation state
Konling SHALL keep development diagnostics separate from the final user-facing citation presentation.

#### Scenario: Streaming answer has not completed final citation verification
- **WHEN** Konling streams a development-mode answer before final citation verification completes
- **THEN** any visible diagnostic notice SHALL be prefixed as development-mode diagnostics
- **AND** that notice SHALL be visually and semantically distinct from verified citations.

#### Scenario: Final answer completes citation verification
- **WHEN** the assistant message has completed generation and final citation metadata is available
- **THEN** the UI SHALL render the final verified, limited, or missing citation state from normalized metadata
- **AND** it SHALL not rely on diagnostic text embedded in the prose as the citation UI.

### Requirement: Konling grounding includes structured associative context
Konling runtime SHALL include structured associative context when SAR association expansion is available for the current mode and scope.

#### Scenario: Scoped learning question is answered
- **WHEN** Konling answers a graph, path, resource, diagnosis, grading, or prep-pack question with available SAR context
- **THEN** the runtime SHALL include SAR seed refs, associated event refs, trace summary, candidate evidence refs, and limitations in server-owned metadata
- **AND** final citations SHALL still be rendered from verified CitationChip or Source Pack citation metadata.

### Requirement: Konling uses one visible chat experience
Konling SHALL render visible chat messages, tool calls, diagnostics, and citations through a shared chat experience while preserving page-specific context, tools, and prompt behavior.

#### Scenario: Konling opens from different learning surfaces
- **WHEN** Konling opens from the knowledge graph, adaptive path center, interactive lesson, copilot page, teacher surface, or administrator surface
- **THEN** the visible message layout, tool-call disclosure, diagnostic label, and citation presentation SHALL use the shared Konling chat renderer
- **AND** the surface SHALL pass route-specific context, permitted tools, assistant entry point, and system prompt extension through the shared context boundary.

#### Scenario: A route needs specialized coaching behavior
- **WHEN** a route requires graph, path, resource, lesson, grading, prep-pack, simulation, or administrator-specific behavior
- **THEN** the route SHALL configure that behavior through server-owned context, scoped tools, and prompt extensions
- **AND** it SHALL NOT duplicate message bubble, tool-call, or citation rendering logic.

#### Scenario: Legacy Konling surface remains reachable
- **WHEN** a legacy sidebar, copilot panel, copilot page, or interactive lesson AI panel remains in the codebase
- **THEN** it SHALL wrap or delegate to the shared Konling chat experience
- **AND** it SHALL NOT maintain an independent visible implementation for assistant replies, tool results, or citation lists.

### Requirement: Konling tool calls use collapsible disclosure UI
Konling SHALL render tool calls as a compact collapsible disclosure rather than injecting repeated raw tool-result messages into the answer.

#### Scenario: Assistant message includes tool calls
- **WHEN** an assistant message includes one or more tool calls
- **THEN** the UI SHALL render a collapsed summary showing the number of called tools
- **AND** expanding the summary SHALL reveal one collapsible row per tool call.

#### Scenario: Tool result row is expanded
- **WHEN** a user expands an individual tool-call row
- **THEN** the UI SHALL show sanitized tool result details for that tool call
- **AND** it SHALL keep raw internal diagnostics hidden unless a development-only diagnostic policy explicitly permits them.

#### Scenario: Tool disclosure icons are rendered
- **WHEN** the tool summary or tool row can expand or collapse
- **THEN** the UI SHALL use standard frontend expand and collapse icons
- **AND** it SHALL NOT use literal `>` or `v` characters as the visible affordance.

### Requirement: Konling chat layout prioritizes answer content
Konling SHALL allocate the chat panel layout to prompt input and assistant answer content without avatar placeholders reducing reply width.

#### Scenario: User composes a prompt
- **WHEN** the Konling input composer is visible in the chat window
- **THEN** the prompt input area SHALL occupy about 75 percent of the Konling window width by default, with implementation validation accepting a 70 percent to 80 percent range
- **AND** action buttons SHALL remain reachable without covering the input.

#### Scenario: Assistant reply is rendered
- **WHEN** Konling renders an assistant reply
- **THEN** the reply SHALL use the full available reply width
- **AND** it SHALL NOT reserve an assistant avatar placeholder that narrows the answer column.

### Requirement: Konling content citations respect answer relevance
Konling SHALL only present Source Pack content citations as high-confidence answer evidence when the selected Source Pack items satisfy the `konling-answer` answer-relevance contract.

#### Scenario: Knowledge graph answer has no relevant content citation
- **WHEN** Konling answers from `/knowledge` and Source Pack retrieval returns no item that satisfies the answer-relevance gate for the current question and server-owned knowledge workspace context
- **THEN** Konling SHALL omit unrelated content citations from answer generation, citation verification, and student-visible citation chips instead of presenting unrelated textbook chunks as high-confidence answer citations
- **AND** runtime citation metadata SHALL expose the missing or downgraded citation reason.

#### Scenario: Knowledge graph answer has relevant content citations
- **WHEN** Konling answers from `/knowledge` and Source Pack retrieval selects items that satisfy answer relevance and citation readiness
- **THEN** Konling SHALL pass those verified content citations into citation context, answer-generation, and citation-verification metadata
- **AND** student-visible citation chips SHALL retain server-owned title, href or unavailable state, source type, confidence, freshness, privacy visibility, and limitation state.

#### Scenario: Known leakage chunks are unrelated
- **WHEN** a knowledge graph Konling request is unrelated to `ADVANCED PROBLEMS` or `DESIGN PROBLEMS` textbook rows
- **THEN** Konling SHALL NOT include `ch01-advanced-problems-031__chunk-001` or sibling rows as high-confidence content citations merely because they are canonical, citation-ready, or broadly graph-bound.

### Requirement: Konling citation relevance diagnostics are privacy safe
Konling SHALL separate internal answer-relevance diagnostics from student-visible citation language.

#### Scenario: Answer citation is omitted for insufficient relevance
- **WHEN** Source Pack reports insufficient answer relevance for a Konling content citation
- **THEN** Konling SHALL retain raw limitation codes, query hashes, selected-node ids, SAR refs, and ranking signals only in service-side metadata, admin/debug diagnostics, or test evidence
- **AND** student-visible answer text and citation chips SHALL use product-safe language without exposing raw internal reason codes or privileged context identifiers.

#### Scenario: Answer citation is selected with relevance evidence
- **WHEN** Konling passes a selected Source Pack item into citation context
- **THEN** the runtime SHALL retain bounded relevance evidence for audit, including the relevance basis and non-private match summary
- **AND** it SHALL NOT require or expose raw private learner evidence, private Konling memory, hidden Arena internals, or audit-only SAR traces.

### Requirement: Konling textbook citations open rendered source pages
Konling SHALL route student-facing textbook content citation clicks to rendered source pages rather than raw runtime Markdown chunks.

#### Scenario: Citation points to a textbook chunk
- **WHEN** Konling presents a verified textbook Source Pack citation whose canonical href points to a runtime Markdown chunk
- **THEN** the student-facing citation link SHALL open a platform-owned rendered reader page for that chunk
- **AND** Konling SHALL retain the canonical runtime href, citation target id, source id, answer-relevance audit metadata when present, missing or downgraded citation reason, confidence, freshness, privacy scope, and limitation metadata for audit and citation verification.

#### Scenario: Citation display href is generated after relevance governance
- **WHEN** Source Pack supplies answer-relevance audit metadata, omitted-citation metadata, or no-relevant-citation downgrade reasons
- **THEN** Konling SHALL preserve that metadata while adding or consuming the rendered display href
- **AND** it SHALL NOT change `konling-answer` selection, ranking, omission, or downgrade semantics solely because a rendered display href is available.

#### Scenario: Citation points to a section or figure anchor
- **WHEN** a textbook citation includes section, figure, image, equation, or anchor metadata
- **THEN** the rendered reader SHALL navigate to or highlight the relevant target when supported
- **AND** unsupported anchors SHALL degrade to the rendered containing chunk or section with an explicit non-student-facing limitation state.

#### Scenario: Citation target is unavailable
- **WHEN** the rendered target cannot be resolved safely, is restricted, or is stale
- **THEN** Konling SHALL show the existing unavailable or limited citation state
- **AND** it SHALL NOT synthesize raw Markdown links or model-authored fallback links.

### Requirement: Konling rendered citation pages hide raw chunk machinery
Konling rendered citation pages SHALL display textbook citations as formatted reading content rather than raw corpus artifacts.

#### Scenario: Rendered chunk includes Markdown and images
- **WHEN** a learner opens a rendered textbook citation page for a chunk containing headings, formulas, lists, image links, and machine image descriptions
- **THEN** the page SHALL render formatted Markdown, formulas, and images
- **AND** it SHALL NOT show raw Markdown image syntax, citation comments, section-id comments, or visible `Image description` retrieval prose.

#### Scenario: Raw runtime route is requested directly
- **WHEN** tooling or a developer opens the canonical `/course-runtime/**` Markdown href directly
- **THEN** the raw Markdown asset MAY still be served as raw Markdown
- **AND** this raw behavior SHALL NOT be used as the student-facing citation click target.

### Requirement: Konling learner context uses portrait v2
Konling SHALL use portrait v2 as the primary learner portrait context when
personalizing explanations, scope, style, and evidence diagnostics.

#### Scenario: Konling answers with learner context
- **WHEN** learner portrait context is available
- **THEN** Konling SHALL summarize strengths, weak dimensions, and limitations using portrait v2 ids and labels
- **AND** legacy six-dimensional data SHALL be identified as compatibility-derived if used.

#### Scenario: Learner portrait is incomplete
- **WHEN** portrait v2 data is missing or migrated with low confidence
- **THEN** Konling SHALL still answer with available content citations
- **AND** it SHALL treat portrait incompleteness as a personalization limitation rather than a retrieval failure.

### Requirement: Konling conversations belong to the authenticated user
Readable Konling conversations, including conversations created or continued from the standalone `/ai/copilot` page, SHALL be owned by one authenticated user and SHALL remain available across supported pages until the user deletes them or explicit global retention governance removes or expires them. A library conversation SHALL NOT become unreadable solely because a fixed product-level seven-day interval elapsed. Every list, read, update, delete and message operation SHALL enforce the same owner and governed-retention eligibility. Every message write SHALL verify conversation ownership and current authorized context before persistence.

#### Scenario: Owner lists conversations
- **WHEN** an authenticated user opens the Konling conversation library
- **THEN** the system SHALL return only that user's readable conversations ordered by pinned state and recent activity.

#### Scenario: Owner lists an older conversation
- **WHEN** an authenticated user opens the Konling conversation library and an owned visible conversation is older than seven days without a governed expiry
- **THEN** the system SHALL return that conversation according to pinned state and recent activity
- **AND** the user SHALL be able to open and continue it.

#### Scenario: Global governance has not scheduled expiry
- **WHEN** a new user conversation enters the readable library
- **THEN** it SHALL have no product-level fixed expiry
- **AND** the absence of a scheduled governance expiry SHALL be represented separately from an expired record.

#### Scenario: Explicit governed expiry has elapsed
- **WHEN** global retention governance has assigned an expiry and that time has elapsed
- **THEN** the conversation SHALL be excluded or removed according to that governance policy
- **AND** the client SHALL NOT treat the result as an empty new conversation with successful recovery.

#### Scenario: Another user requests a conversation
- **WHEN** a user requests a conversation owned by another user without an authorized governance role
- **THEN** the system SHALL deny access to its title, messages, context records and tool runs.

#### Scenario: Conversation produces a structured task action
- **WHEN** a conversation proposes or applies a smart-preparation task change
- **THEN** the proposal, tool run, and applied artifact SHALL retain exact task and task-revision lineage
- **AND** user-level conversation ownership SHALL NOT replace domain artifact ownership or revision binding.

#### Scenario: Owner continues a conversation from standalone Copilot
- **WHEN** an authenticated user selects an owned conversation on `/ai/copilot` and sends a new message
- **THEN** the runtime SHALL persist the exchange in that conversation
- **AND** the updated conversation SHALL remain available through the shared conversation library.

#### Scenario: Another user requests a standalone Copilot conversation
- **WHEN** a user supplies a conversation identity owned by another user
- **THEN** the runtime SHALL deny access to its title, messages, context records and tool runs
- **AND** it SHALL NOT persist the attempted message.

### Requirement: Conversation library supports deliberate organization
The library SHALL support new conversation, title search, manual rename, pin or unpin, and confirmed deletion for every owner-readable conversation that has not reached an explicit governed expiry.

#### Scenario: First exchange completes
- **WHEN** the first complete user question and assistant answer are persisted and the title has not been manually edited
- **THEN** the system SHALL assign an automatic title derived from the exchange
- **AND** it SHALL fall back to a bounded form of the first user prompt when naming cannot complete.

#### Scenario: Manually named conversation receives later messages
- **WHEN** a user has renamed a conversation
- **THEN** automatic naming SHALL NOT overwrite the manual title.

#### Scenario: User searches titles
- **WHEN** the user enters a search term
- **THEN** the library SHALL filter by conversation title
- **AND** full message-content search SHALL NOT be required.

#### Scenario: Owner organizes an older retained conversation
- **WHEN** an owned conversation is older than seven days and has no governed expiry
- **THEN** the user SHALL still be able to rename, pin, unpin and delete it
- **AND** each operation SHALL preserve the existing conversation identity until deletion.

#### Scenario: Current conversation is deleted
- **WHEN** the user confirms deletion of the active conversation
- **THEN** the conversation and its owned message and tool-run records SHALL be removed according to retention rules
- **AND** the UI SHALL open a new blank conversation while independently persisted platform artifacts remain.

### Requirement: Cross-page continuation appends context without rewriting history
The runtime SHALL preserve the initiating page context and SHALL append one server-authored current-page context record immediately before a new user message when a shared conversation continues from `/ai/copilot` or another materially different authorized page context. A standalone Copilot task descriptor SHALL be revalidated for the current request and MUST NOT rewrite prior context or expand conversation authority.

#### Scenario: Conversation continues on the same page context
- **WHEN** the current authorized page-context identity matches the latest recorded context
- **THEN** the runtime SHALL append only the new user message
- **AND** it SHALL NOT duplicate the page-context record.

#### Scenario: Conversation continues on another page
- **WHEN** the current authorized page-context identity differs from the latest recorded context
- **THEN** the runtime SHALL append the new current-page context record and then the user message in that order
- **AND** it SHALL NOT rewrite the system prefix, initiating context, prior context records, or prior messages.

#### Scenario: Client supplies unauthorized context
- **WHEN** client hints contain data outside the user's current authorized page scope
- **THEN** the server SHALL omit or reject those fields before persisting the context record.

#### Scenario: Conversation continues on standalone Copilot with a new task context
- **WHEN** an owned conversation continues on `/ai/copilot` with a currently supported portfolio-reflection or evidence task descriptor
- **THEN** the runtime SHALL validate and append the current authorized context before the user message
- **AND** prior system context, messages and task boundaries SHALL remain unchanged.

#### Scenario: Client supplies unauthorized standalone task context
- **WHEN** client hints or historical messages claim evidence, writeback or learner authority outside the current user's authorized task contract
- **THEN** the server SHALL omit or reject those claims before persisting context or invoking the model.

### Requirement: Existing usable conversations migrate into the library
The system SHALL migrate and retain existing readable Konling sessions idempotently while preserving chronological messages, readable tool records and original timestamps. Existing rows already marked `libraryVisible=true` but hidden only by the obsolete fixed seven-day expiry SHALL be restored without creating duplicate conversations. Rows excluded as empty, failed initialization or non-library technical sessions SHALL remain excluded.

#### Scenario: Existing session has usable history
- **WHEN** a session contains at least one readable exchange or meaningful tool record and is not expired
- **THEN** it SHALL appear as one owner-scoped library conversation with an automatic title when needed.

#### Scenario: Existing session is not usable
- **WHEN** a session is expired, empty, or contains only failed initialization
- **THEN** it SHALL be excluded from the conversation library migration.

#### Scenario: Migration runs again
- **WHEN** the migration is rerun
- **THEN** it SHALL reuse prior migration identity
- **AND** it SHALL NOT duplicate conversations, messages, or tool runs.

#### Scenario: Previously visible conversation crossed the old seven-day boundary
- **WHEN** a user-owned row is `libraryVisible=true`, still exists in storage and was hidden only because its old fixed expiry elapsed
- **THEN** the migration SHALL restore it to the readable conversation library
- **AND** it SHALL preserve messages, title, pin state, creation time and activity time.

#### Scenario: Legacy session was excluded from the library
- **WHEN** a legacy row is `libraryVisible=false` because it was empty, expired before the original migration or contained only failed initialization
- **THEN** the retention migration SHALL NOT promote it into the conversation library.

#### Scenario: Retention migration runs again
- **WHEN** the migration is rerun
- **THEN** it SHALL leave already restored identities and message history unchanged
- **AND** it SHALL NOT duplicate conversations, messages or tool runs.

### Requirement: Konling supports side and maximized presentation modes
Konling SHALL open in the existing side-panel mode by default and SHALL provide controls to maximize into a full-screen workspace and restore to the side panel.

#### Scenario: User maximizes Konling
- **WHEN** the user activates maximize from the side panel
- **THEN** the assistant SHALL animate into a full-screen workspace
- **AND** the workspace SHALL show the conversation library on the left and the active conversation on the right at desktop width.

#### Scenario: User restores the side panel
- **WHEN** the user activates restore
- **THEN** Konling SHALL return to the side-panel geometry
- **AND** the active conversation SHALL remain selected.

### Requirement: Presentation changes preserve conversation continuity
Changing Konling presentation mode SHALL preserve active conversation state.

#### Scenario: Mode changes during an active conversation
- **WHEN** the user maximizes or restores while messages, draft input, streaming output, scroll position, or focus state exist
- **THEN** those states SHALL remain associated with the same conversation
- **AND** the runtime SHALL NOT create a new session or duplicate the active response.

#### Scenario: Reduced motion is requested
- **WHEN** the user's system requests reduced motion
- **THEN** the mode transition SHALL avoid nonessential animation while preserving the same layout result.

### Requirement: Maximized Konling remains usable on mobile
The maximized assistant SHALL provide mobile access to both conversation history and the active conversation.

#### Scenario: Maximized mode renders on a narrow screen
- **WHEN** the viewport cannot fit the history rail and conversation together
- **THEN** history SHALL be available through a drawer or equivalent compact navigation
- **AND** the message list and composer SHALL remain reachable without horizontal page scrolling.

### Requirement: Konling exposes textbook retrieval through page tool contracts
Konling SHALL register textbook RAG as a shared read-only tool and SHALL expose it only when the server-owned page, mode, and role contract permits course-knowledge retrieval.

#### Scenario: Page contract permits textbook retrieval
- **WHEN** a learning surface exposes the textbook tool and the model determines that the current question needs textbook support
- **THEN** the model MAY call the tool with the current question
- **AND** the runtime SHALL apply the page's existing server-owned context without introducing a knowledge-graph-only context path.

#### Scenario: Tool is exposed but unused
- **WHEN** the model answers without calling the available textbook tool
- **THEN** the runtime SHALL treat that as a normal model decision
- **AND** it SHALL NOT mark the answer degraded solely because the tool was unused.

### Requirement: Konling uses server-assigned visible citation numbers
Konling SHALL use one server-assigned citation sequence for textbook content and authorized learning evidence and SHALL reject model-authored URLs or new identifiers.

#### Scenario: Citation table is prepared
- **WHEN** eligible content and evidence sources are ready before answer generation
- **THEN** the server SHALL deduplicate them and assign `[1]`, `[2]` display numbers
- **AND** the prompt SHALL allow only those assigned numbers.

#### Scenario: Model emits internal citation syntax
- **WHEN** model prose contains a raw citation id, `[content: ...]`, an unknown number, or a model-authored citation URL
- **THEN** that syntax SHALL NOT become a verified visible citation or link.

### Requirement: Konling repairs unknown citation markers once
Konling SHALL deterministically normalize known citation forms and SHALL permit at most one model repair call for remaining unknown or ambiguous markers.

#### Scenario: Deterministic normalization succeeds
- **WHEN** a marker contains an assigned number, a complete known citation id, or a uniquely matching source title
- **THEN** the server SHALL map it without an additional model call.

#### Scenario: Unknown markers remain
- **WHEN** deterministic normalization leaves unresolved markers
- **THEN** one repair call SHALL receive the original question, frozen server context, assigned citation table, original answer, and all unresolved markers
- **AND** it SHALL return mappings only without rewriting prose or adding sources.

#### Scenario: Repair still fails
- **WHEN** markers remain unresolved after the repair call
- **THEN** production output SHALL remove their raw syntax and invalid links, preserve the answer prose, and show the applicable safe verification notice
- **AND** detailed reasons SHALL remain available only in development diagnostics.

### Requirement: Konling supports soft-timeout textbook optimization
Konling SHALL start a fallback-grounded answer after the configured foreground retrieval wait while allowing bounded external retrieval to continue.

#### Scenario: External retrieval exceeds foreground wait
- **WHEN** embedding and reranking have not completed after approximately two seconds
- **THEN** Konling SHALL answer from lexical or local fused candidates
- **AND** production UI SHALL show `正在后台优化响应` without provider, timeout, or error details.

#### Scenario: Background evidence is equivalent
- **WHEN** external retrieval completes before the experiment-derived P95 cap and the preferred source and used citation-unit set are unchanged
- **THEN** the UI SHALL end the optimization status without regenerating the answer.

#### Scenario: Background evidence materially changes
- **WHEN** external retrieval completes before the cap and changes the preferred source or used citation-unit set
- **THEN** Konling SHALL regenerate from the frozen question and final evidence and replace the same message revision
- **AND** it SHALL NOT append a second assistant response.

#### Scenario: Background retrieval reaches its cap
- **WHEN** the external work has not completed by the experiment-derived P95 limit
- **THEN** the fallback-grounded answer SHALL remain final
- **AND** the optimization status SHALL end with operational diagnostics kept outside production prose.

### Requirement: Konling final messages replace provisional revisions
The shared chat experience SHALL support one visible message identity whose body, citations, and final state can be replaced after citation repair or material background optimization.

#### Scenario: Citation mapping is corrected
- **WHEN** the single citation repair call resolves provisional markers
- **THEN** the corrected body and citation presentation SHALL replace the current message revision
- **AND** the provisional and corrected variants SHALL NOT remain as separate visible messages.

### Requirement: Provider tool-call syntax never renders as assistant prose
The Konling runtime SHALL normalize streamed and final provider events into text, tool-call, tool-result, citation, and terminal events before user-visible rendering.

#### Scenario: Provider returns DSML tool syntax
- **WHEN** a provider emits a complete recognized DSML or provider-specific tool-call envelope
- **THEN** the runtime SHALL parse it into a structured tool call
- **AND** the envelope SHALL NOT appear in the assistant's visible text.

#### Scenario: Structured syntax is malformed
- **WHEN** deterministic parsing cannot safely classify a possible tool-call envelope
- **THEN** the runtime SHALL withhold the raw syntax and enter bounded correction or an actionable failure state
- **AND** it SHALL NOT present the markup as a successful answer.

### Requirement: Tool runs and structured actions persist with their assistant turn
Each structured action SHALL be linked to a persisted assistant turn and tool-run identity so reopening a conversation restores the same card and state.

#### Scenario: Tool call completes
- **WHEN** a permitted tool call succeeds or fails
- **THEN** its redacted input summary, output or error summary, status, timestamps, and idempotency identity SHALL be persisted
- **AND** the message renderer SHALL reconstruct its action or status card from server records.

#### Scenario: Conversation is reopened
- **WHEN** the user reopens a conversation containing structured actions
- **THEN** applied, ignored, failed, and pending action states SHALL render consistently
- **AND** reopening SHALL NOT rerun a completed tool automatically.

### Requirement: Smart-preparation proposals render as in-message action cards
The `propose_smart_lesson_task_change` result SHALL render inside the responsible assistant message with `应用` and `忽略` actions.

#### Scenario: Proposal card is presented
- **WHEN** a structured task proposal is persisted
- **THEN** the card SHALL show a teacher-readable summary of the proposed changes before any task mutation
- **AND** no proposal SHALL apply until the teacher selects `应用`.

#### Scenario: Teacher applies a current proposal
- **WHEN** the teacher selects `应用` and the task revision still matches
- **THEN** the structured task service SHALL apply the proposed diff once
- **AND** the affected smart-preparation accordion stage SHALL update, highlight the accepted change briefly, and then return to its ordinary presentation.

#### Scenario: Proposal conflicts with a newer task revision
- **WHEN** the task changed after the proposal was created
- **THEN** the action card SHALL report the conflict and offer refresh or a new proposal
- **AND** it SHALL NOT overwrite the newer task.

#### Scenario: Teacher ignores a proposal
- **WHEN** the teacher selects `忽略`
- **THEN** the card SHALL persist the ignored state
- **AND** the task SHALL remain unchanged.

#### Scenario: Proposal application fails
- **WHEN** an authorized proposal cannot be applied for a reason other than a stale revision
- **THEN** the original card SHALL persist an actionable failure state
- **AND** the task SHALL remain unchanged and a duplicate click SHALL not apply the proposal twice.

### Requirement: Page-specific Konling tools remain focused
Each page or assistant mode SHALL continue to expose only its authorized focused tool set while retaining the project's existing context injection.

#### Scenario: Conversation opens in a new page context
- **WHEN** an existing conversation continues on another page
- **THEN** the runtime SHALL use that page's permitted tools for the new turn
- **AND** it SHALL not retroactively alter tools or context recorded for prior turns.

### Requirement: Tool-call correction consumes the shared message-revision contract
Konling tool-call correction SHALL reuse the provisional-message identity, `正在后台优化响应` state, same-message replacement, and bounded p95 wait defined by `integrate-konling-textbook-rag`.

#### Scenario: Tool-call correction is required
- **WHEN** deterministic normalization withholds malformed structured syntax and starts the single permitted correction
- **THEN** the correction SHALL update the existing provisional message through the shared message-revision contract
- **AND** this change SHALL NOT create a second visible answer, wait controller, or message replacement implementation.

### Requirement: Konling uses candidate Canonical page context
When Konling is invoked from the candidate graph, it MUST receive the aggregate ReleaseSet identity and projection digest, selected Canonical Object, graph filters, actual candidate coverage, release tier, and explicit teaching-semantics availability state.

#### Scenario: Selected candidate object is explained
- **WHEN** the user asks about a selected Canonical Object in `control-theory-engineering-v0.2`
- **THEN** Konling SHALL use its Canonical ID, aggregate ReleaseSet, exact typed relations, and available public provenance rather than searching Legacy nodes by label

#### Scenario: Teaching semantics are unavailable
- **WHEN** the aggregate release does not yet provide prerequisite, containment, or related formal Teaching Projection semantics required by the request
- **THEN** Konling SHALL expose that limitation and SHALL NOT infer those relations from display order, Legacy graph, or resource similarity

#### Scenario: Historical candidate context is encountered
- **WHEN** a stored conversation turn references the prior root-locus ReleaseSet
- **THEN** the runtime SHALL retain that turn as history but SHALL bind a new candidate-graph turn to the current aggregate ReleaseSet without merging their objects or provenance

### Requirement: Candidate graph exposes a focused read-only tool set
The candidate graph context SHALL expose Repository-backed Canonical search, node detail, and bounded neighbor tools, and SHALL exclude state-changing knowledge actions.

#### Scenario: Model searches neighbors
- **WHEN** Konling requests related candidate objects
- **THEN** the tool SHALL return precise predicate, direction, governance level, and ReleaseSet provenance

#### Scenario: Model attempts a state-changing action
- **WHEN** a candidate response attempts to create a learning fact, execute a path, or update learner state
- **THEN** the server SHALL reject the action and preserve the candidate context as read-only

### Requirement: Candidate context does not replace platform context injection
The candidate graph additions MUST extend the existing page-scoped context contract without creating a graph-only assistant mode.

#### Scenario: Conversation continues on another page
- **WHEN** the same user opens the conversation elsewhere and sends a new message
- **THEN** the runtime SHALL append the new page context before the message while retaining the prior conversation structure

### Requirement: Candidate graph public activation waits for Konling acceptance
The system MUST keep the candidate graph unavailable to ordinary users until its Canonical context, focused tools, diagnostics, and no-side-effect gates all pass acceptance.

#### Scenario: Candidate Konling acceptance passes
- **WHEN** V2 graph acceptance and all candidate Konling read-only tests pass on the same ReleaseSet
- **THEN** the system SHALL open the candidate view to all existing graph users and set it as the migration-period default

#### Scenario: Candidate Konling acceptance fails
- **WHEN** any candidate context, provenance, or side-effect test fails
- **THEN** the public activation gate SHALL remain closed and users SHALL continue on the Legacy graph

### Requirement: Konling intervention records retain official-evaluation round evidence
When a companion intervention is created from an official Arena submission, the Konling runtime SHALL persist the scoped official submission reference as intervention evidence and SHALL preserve it for a same-task follow-up comparison.

#### Scenario: Official-evaluation intervention is persisted
- **WHEN** the runtime records a companion intervention from a supported official submission
- **THEN** the intervention evidence includes the triggering official submission reference and task identity
- **AND** the reference remains restricted to the intervention owner's authorized scope

### Requirement: Konling cooldown deduplicates one official result
The Konling runtime SHALL prevent duplicate companion interventions for the same scoped official submission. A completed same-task follow-up comparison MUST permit a new intervention that is grounded in the follow-up submission even if an earlier time-based cooldown has not elapsed.

#### Scenario: Same official result is revisited
- **WHEN** the client repeats a request for a companion intervention for the same official submission
- **THEN** the runtime returns or reuses the existing intervention outcome
- **AND** it does not create a second intervention record

#### Scenario: Follow-up is a new official result
- **WHEN** a follow-up official submission has closed the prior intervention round and meets an intervention condition
- **THEN** the runtime permits a new scoped intervention for that follow-up submission

### Requirement: Companion feedback remains non-authoritative
The Konling runtime SHALL persist a student's companion helpfulness feedback as an intervention outcome within the existing privacy and scope controls. That feedback MUST NOT be treated as proof of task attainment, knowledge mastery, or a request to mutate a learning path.

#### Scenario: Student rates companion advice
- **WHEN** a student submits helpfulness feedback for a companion intervention
- **THEN** the runtime records the intervention outcome and its evidence reference
- **AND** it does not create or alter a learning-path plan, task-standard result, or mastery conclusion

### Requirement: Konling adjustment returns a persisted derived candidate batch
Konling SHALL execute candidate adjustment against an authorized persisted source candidate and SHALL return the server-owned derived batch and candidate identities only after a materially changed batch is persisted.

#### Scenario: Adjustment succeeds materially
- **WHEN** Konling completes an authorized candidate adjustment with materially changed candidates
- **THEN** its structured result SHALL reference the persisted derived batch and candidate identities
- **AND** the adaptive learning center SHALL be able to read the same batch without regenerating candidates from assistant text.

#### Scenario: Adjustment has no material difference
- **WHEN** the governed adjustment result does not differ materially from the source candidate
- **THEN** Konling SHALL return `no_material_difference`
- **AND** it SHALL NOT claim that a new path was generated or selected.

### Requirement: Konling adjustment audit does not create path-choice evidence
Konling SHALL record candidate adjustment as its own governed tool run and outcome and SHALL NOT record a path selection, rejection, or switch unless the learner separately performs that explicit action.

#### Scenario: Adjustment tool completes
- **WHEN** a candidate adjustment tool succeeds, fails, becomes stale, or returns no material difference
- **THEN** its AgentToolRun SHALL preserve the adjustment request and redacted outcome according to the existing audit contract
- **AND** it SHALL NOT create `action: switch` or equivalent path-choice evidence.

#### Scenario: Learner later chooses an adjusted candidate
- **WHEN** the learner explicitly selects a candidate from the derived batch
- **THEN** the existing path-choice workflow MAY record selection or switch evidence independently from the adjustment tool run.

### Requirement: Resource coach consumes version-bound textbook context
Konling `resource-coach` SHALL accept unified textbook reader context only after the server has authorized and resolved a complete `structured-textbook-unit` identity. Client page context SHALL remain a hint and SHALL NOT establish trusted resource body, version, anchor, permission, or citation scope.

#### Scenario: Textbook resource coach becomes ready
- **WHEN** the current actor is authorized and the server validates `resourceId`, `bookId`, `edition`, `sourceRevision`, `unitId`, `contentHash`, and any requested registered `anchorId`
- **THEN** `resource-coach` SHALL use the server-reloaded bounded unit or fragment context
- **AND** the server SHALL atomically persist that complete resource identity before producing the first grounded answer.

#### Scenario: Subsequent turn uses the resource session
- **WHEN** the user asks another question in an existing version-bound resource-coach session
- **THEN** Konling SHALL reauthorize the actor and revalidate the pinned revision, unit, hash, and anchor before using resource context
- **AND** client hints or a newer active runtime SHALL NOT silently replace the session identity.

#### Scenario: Resource context cannot be revalidated
- **WHEN** permission is denied, the pinned revision is unavailable, the content hash drifts, the unit mapping changes, or the anchor is invalid
- **THEN** `resource-coach` SHALL return a visible unavailable or degraded reason appropriate to the failure
- **AND** it SHALL NOT answer from generic chat as though it had verified the requested resource context.

#### Scenario: Resource-grounded answer exposes citations
- **WHEN** Konling returns an answer supported by the verified textbook context
- **THEN** answer metadata SHALL include only server-assigned citation identifiers whose hydrated version-bound addresses match the pinned resource identity and can resolve that exact identity at click time
- **AND** missing or unverified support SHALL be labeled as having no verifiable citation rather than supplemented with a model-authored source.

### Requirement: Path generation request identity survives unknown outcomes
The Konling path-generation boundary SHALL preserve one client-visible generation request identity across rerenders, repeated callbacks, active-status checks, and retries whose server outcome is unknown.

#### Scenario: Generation response is lost
- **WHEN** a path-generation request reaches the server but the client receives a connection failure or an unexpected route exception
- **THEN** the client SHALL retain the original generation request identity for its next query or retry
- **AND** the server SHALL derive the same AgentToolRun idempotency key from that identity

#### Scenario: Existing generation is still active
- **WHEN** the same owner repeats a generation request whose AgentToolRun is pending or running
- **THEN** the runtime SHALL return the existing run state
- **AND** it SHALL NOT create a duplicate active path round

#### Scenario: Runtime reports a definitive terminal result
- **WHEN** the runtime reports succeeded, blocked, or failed for a generation request
- **THEN** the response SHALL preserve the request identity and expose the definitive lifecycle state
- **AND** a later explicit regeneration SHALL use a new request identity

### Requirement: Konling generation results expose persisted batch identity
After successful adaptive path generation, Konling SHALL receive and expose the persisted candidate batch ID and candidate IDs returned by the server, and SHALL NOT derive those identities from assistant text.

#### Scenario: Successful generation returns shared identity
- **WHEN** Konling completes a path generation request successfully
- **THEN** its structured result references the same batch ID and candidate IDs that the path center can read

### Requirement: Konling reads planner candidates without rewriting them
When explaining a persisted batch, Konling SHALL use the server-owned batch projection and SHALL preserve planner ordering, candidate content, and recommendation provenance.

#### Scenario: Explanation uses stored candidates
- **WHEN** Konling explains or links to a candidate from a successful batch
- **THEN** it references the persisted candidate and does not independently re-rank, regenerate, or rewrite the candidate set

### Requirement: Arena intervention persistence requires official submission evidence
The Konling runtime SHALL create a governed Arena control-workbench intervention only when the request carries a server-verified official submission reference owned by the authenticated student and scoped to the current task. Client-authored `StudentState`, parameters, metrics, outcome, task id or method MUST NOT be sufficient to create intervention evidence, Memory, feedback identity or cooldown state.

#### Scenario: Runtime receives only client-authored state
- **WHEN** the Arena intervention path receives attempt history or current state without a verified official submission reference
- **THEN** the runtime SHALL fail before creating an intervention, evidence record, Memory or feedback identity.

#### Scenario: Official submission scope does not match
- **WHEN** the referenced official submission belongs to another student or task, or its method cannot be resolved from the registered task
- **THEN** the runtime SHALL reject the request
- **AND** it SHALL not fall back to client-supplied state.

#### Scenario: Legacy row lacks official evidence
- **WHEN** an existing intervention was created without a verifiable official submission reference
- **THEN** the runtime SHALL exclude it from official baseline, follow-up and cooldown resolution
- **AND** it SHALL preserve the row for authorized historical audit unless separate retention governance removes it.

### Requirement: Konling exposes server-owned assistant-binding lookup
The Konling conversation runtime SHALL expose a bounded owner-scoped way to identify conversations whose persisted teaching-assistant binding exactly matches a currently authorized resource-coach identity. The lookup SHALL NOT expose raw messages, private mode context or another user's conversation metadata.

#### Scenario: Exact persisted binding matches
- **WHEN** an authenticated user requests a conversation for an authorized resource-coach identity that exactly matches an owned persisted binding
- **THEN** the runtime SHALL return or select that conversation as the matching session
- **AND** the client SHALL be able to recover its visible messages without creating a replacement.

#### Scenario: Client-only binding is supplied
- **WHEN** the requested identity exists only in `sessionStorage`, URL state or other client hints and cannot be revalidated on the server
- **THEN** the runtime SHALL NOT treat it as a persisted match or grant resource access.

#### Scenario: Binding belongs to another user or version
- **WHEN** a candidate conversation belongs to another user or differs in revision, unit, content hash or normalized anchor
- **THEN** the runtime SHALL exclude it from the match.

### Requirement: Resource-coach creation does not leave visible unbound sessions
When no matching resource-coach conversation exists, the runtime SHALL establish the new owned conversation and validated binding no earlier than the user's first intentional question and before model execution. Creation retries SHALL be idempotent for the same user and exact resource identity, and a failed first-turn setup MUST NOT leave a `libraryVisible=true` conversation without a recoverable binding.

#### Scenario: User submits the first resource question
- **WHEN** the authorized user submits the first question from an unpersisted blank resource-coach state
- **THEN** the runtime SHALL create or reuse one owned conversation and persist the verified binding before invoking the model.

#### Scenario: Two first questions race
- **WHEN** two requests concurrently attempt to start coaching for the same user and exact resource identity
- **THEN** the runtime SHALL select one recoverable conversation identity or otherwise prevent duplicate visible empty sessions.

#### Scenario: Binding setup fails
- **WHEN** authorization, version validation or persistence fails before the first answer
- **THEN** the runtime SHALL return an explicit failure
- **AND** it SHALL not leave a visible unbound conversation in the user's library.

### Requirement: Public Konling conversation responses exclude internal context records
Every student-facing Konling conversation API SHALL project messages on the server before serialization. The public `messages` collection MUST contain only student-visible `user` and `assistant` messages with approved public metadata and parts. Persisted `system` context records, assistant-binding records, their content and their metadata MUST NOT be returned to the browser. A bounded public `assistantBinding` MAY be derived separately from the complete server-owned history.

#### Scenario: Owner loads a conversation containing page context
- **WHEN** an authenticated owner loads a conversation whose persisted history contains a system page-context record with class, resource, path, release, projection, dataset or Canonical identifiers
- **THEN** the response SHALL preserve the ordered student-visible user and assistant messages
- **AND** the raw response SHALL contain no system message or value copied from that internal context record.

#### Scenario: Conversation contains an assistant-binding record
- **WHEN** the persisted history contains a server-authored assistant-binding system record
- **THEN** the raw response SHALL omit that message and its metadata from `messages`
- **AND** the response MAY include only the separately normalized public `assistantBinding` fields allowed by the existing binding contract.

#### Scenario: Browser code inspects the unrendered response
- **WHEN** student-owned page code, browser developer tools or another same-origin script reads the conversation JSON before React rendering
- **THEN** no client-side visibility filter SHALL be required to protect internal system context
- **AND** the response SHALL already satisfy the student-safe projection boundary.

#### Scenario: Public structured assistant content is restored
- **WHEN** a visible assistant message contains approved citations, revision state, correction state or public structured actions
- **THEN** the public projection SHALL retain the allowed student-facing representation
- **AND** private tool parts and non-public metadata SHALL remain excluded.

### Requirement: Konling presents student-safe failures with state-appropriate recovery
Every active student-facing Konling chat surface SHALL convert transport, HTTP, stream and network failures into a bounded student failure category before rendering. The visible error MUST use Simplified Chinese product copy and MUST NOT include raw response bodies, JSON, browser or SDK exception text, provider details, stack traces, route names or internal machine codes. Recovery actions SHALL match the state transition required by the failure rather than replaying every failed request.

#### Scenario: Chat API returns a structured non-success response
- **WHEN** the AI chat API returns a non-2xx JSON response containing a stable code and public message
- **THEN** the shared client boundary SHALL classify the failure using only allowlisted status and code values
- **AND** the UI SHALL render the bounded student copy rather than the serialized JSON body.

#### Scenario: Browser fetch fails before receiving a response
- **WHEN** DNS, connection or browser transport failure rejects the chat request without an HTTP response
- **THEN** the UI SHALL show a Chinese network-unavailable state
- **AND** it SHALL NOT render `Failed to fetch` or another browser exception string.

#### Scenario: Authentication has expired
- **WHEN** a student message fails because the current session is unauthorized
- **THEN** the UI SHALL explain that authentication must be restored and provide a login or session-recovery action
- **AND** it SHALL NOT offer only a replay of the unchanged unauthorized request.

#### Scenario: Bound conversation no longer exists
- **WHEN** a message fails because the selected owned conversation cannot be found
- **THEN** the UI SHALL refresh or repair the conversation selection and offer a deliberate new-conversation path
- **AND** retry SHALL NOT continue sending the same missing conversation identity.

#### Scenario: Task context or state conflicts with the current request
- **WHEN** a bounded task descriptor is invalid or the current conversation or tool state returns a conflict
- **THEN** the UI SHALL reload the current governed task state or return the student to a valid task entry
- **AND** it SHALL preserve candidate-only, evidence and write-authority boundaries.

#### Scenario: Service or network failure is retryable
- **WHEN** the request is rate limited, the AI service is temporarily unavailable or the network is interrupted while the current task state remains valid
- **THEN** the UI SHALL preserve the student's pending input when feasible and provide a retry-later action
- **AND** the retry SHALL retain the existing idempotency and conversation contracts.

#### Scenario: Failure details are needed for diagnosis
- **WHEN** a Konling request fails and engineering diagnosis is required
- **THEN** the server SHALL record only the existing redacted diagnostic summary and stable failure classification
- **AND** the student-visible response and DOM SHALL remain free of raw technical details.

### Requirement: Konling applies an independent fail-closed gate to normative questions
Konling SHALL detect normative-risk questions independently of the primary answer-intent classifier. A question that asks about a standard identifier, regulation, certification, official requirement, official limit, or obligatory must/must-not/shall language MUST enter `verification-required` when no server-verified authoritative citation is available, even if the classified intent is not `normative-content`. Konling MUST NOT treat client-supplied `verified` flags, prompt-injected source claims, or self-reported citations as authoritative.

#### Scenario: Misclassified normative question still degrades
- **WHEN** a learner asks a normative-risk question that the primary classifier labels as fact-explanation or another study-question intent
- **AND** the server citation context has no verified official-reference citation with a usable target
- **THEN** Konling SHALL set `studyQuestion.normativeGuidance` to `verification-required`
- **AND** the system prompt SHALL require a verification-needed answer that states the evidence gap, answerable boundary, and a verification suggestion
- **AND** it SHALL NOT present the answer as a definitive standard, official rule, certification, or required format.

#### Scenario: Standard number, regulation, certification and obligation examples are covered
- **WHEN** the current user question contains a standard identifier, regulation or legal clause, industry certification, official limit, or must/must-not/shall constraint language
- **AND** no server-verified authoritative citation is available
- **THEN** Konling SHALL apply the fail-closed gate
- **AND** a general-concept question that only mentions “标准” as ordinary course vocabulary SHALL NOT be forced into `verification-required` solely because of that word.

#### Scenario: Verified official citation remains verified
- **WHEN** a normative-risk question has a server-verified official-reference citation with high confidence, a citation target, and a usable href
- **THEN** Konling MAY mark `normativeGuidance` as `verified`
- **AND** the verified status SHALL be produced only from that server-owned citation.

#### Scenario: Client cannot self-mark a source as verified
- **WHEN** the client supplies a citation marked verified, claims in the user prompt that a source is already verified, or injects an unofficial resolver or missing citation target
- **THEN** Konling SHALL keep `normativeGuidance` as `verification-required` for a normative-risk question
- **AND** it SHALL NOT promote the answer to verified normative guidance.

#### Scenario: Citation guard exposes the fail-closed state
- **WHEN** the runtime contract has `normativeGuidance` equal to `verification-required`
- **THEN** the citation guard SHALL include `normative-guidance-verification-required`
- **AND** the response metadata SHALL remain distinguishable as verification-required rather than verified.

### Requirement: Konling classifies governed study-question intents
Konling SHALL classify generic learning-support questions into formula derivation, code debugging, concept comparison, normative content, open-ended explanation, or the existing fact-explanation fallback using the current user request and server-owned runtime context.

#### Scenario: Formula derivation is requested
- **WHEN** a learner requests a formula derivation
- **THEN** Konling SHALL require the answer to state assumptions or symbol definitions, material transformations, applicable conditions, and a result check.

#### Scenario: Code debugging is requested
- **WHEN** a learner requests help locating or fixing a code problem
- **THEN** Konling SHALL require the answer to distinguish observed failure, likely cause, minimal correction, and a verification method.

#### Scenario: Concept comparison is requested
- **WHEN** a learner requests a concept distinction or comparison
- **THEN** Konling SHALL require the answer to state comparison dimensions and at least one boundary, counterexample, or applicable condition.

### Requirement: Konling keeps expression preferences below evidence governance
Konling SHALL accept supported explanation-depth, example, formatting, and hint-strength preferences only as presentation constraints.

#### Scenario: Learner requests a custom explanation format
- **WHEN** a learner asks for a shorter explanation, a domain-specific example, a structured format, or hints instead of a full answer
- **THEN** Konling SHALL adapt the answer presentation
- **AND** it SHALL NOT relax the evidence, citation, or normative-content requirements of the resolved answer intent.

### Requirement: Konling marks normative answers as verified or verification-required
Konling SHALL treat requests for standards, prescribed formats, official rules, legal requirements, or other normative content as authoritative only when the answer is supported by server-verified eligible authority citations.

#### Scenario: Normative content has eligible authority evidence
- **WHEN** a normative-content answer has a server-verified authoritative citation with a usable target
- **THEN** Konling SHALL identify the answer as verified normative guidance and expose its source information through platform citation metadata.

#### Scenario: Normative content lacks eligible authority evidence
- **WHEN** a normative-content answer lacks a server-verified authoritative citation with a usable target
- **THEN** Konling SHALL mark the answer as verification-required
- **AND** it SHALL NOT present the content as a definitive standard, official rule, or required format.

### Requirement: Konling binds material answer units to governed citations
Konling SHALL bind material conclusions, derivation transformations, and code repair recommendations to server-verified citation targets when content citations are available for the resolved study-question intent.

#### Scenario: A material answer unit cites evidence
- **WHEN** Konling produces a cited material conclusion, transformation, or repair recommendation
- **THEN** the response metadata SHALL identify the answer unit, its supported citation target, and any source limitation.

#### Scenario: A proposed citation is not server-verified
- **WHEN** model output contains a citation marker that cannot be mapped to an eligible server-verified citation target
- **THEN** the marker SHALL NOT become a verified citation link or evidence binding.

### Requirement: Konling maps answer units to citations through governed section policies
Konling SHALL map every study-question answer section to an evidence-required or model-derived citation policy, bind per-unit citation markers to the section they appear in, and report per-section traceability coverage in citation metadata.

#### Scenario: Evidence-required section carries per-unit citations
- **WHEN** a study-question answer includes an evidence-required section that is present in the answer
- **THEN** the citation guard SHALL report whether that section's answer units carry server-verified citations, counting the section as covered only when every substantive answer unit in it carries a citation
- **AND** an uncovered evidence-required section SHALL downgrade the answer confidence with a section-scoped reason.

#### Scenario: Model-derived sections stay distinguishable from source text
- **WHEN** a study-question answer includes model-derived sections such as derivation transformations or teaching elaborations
- **THEN** the response metadata SHALL identify those sections as model-derived so they are not presented as source quotations.

#### Scenario: Normative fail-closed answers keep coverage measurement honest
- **WHEN** a normative-content answer lacks eligible authority evidence and is marked verification-required
- **THEN** its sections SHALL NOT count toward traceability coverage requirements.

### Requirement: Konling removes invalid citation markers from persisted answers
Konling SHALL report numeric citation markers that resolve to missing, out-of-range, or unverified citation numbers, and SHALL remove them from the persisted answer body whenever a study-question contract is active.

#### Scenario: An invalid numeric marker appears in the answer
- **WHEN** model output contains a numeric citation marker that is not a server-assigned, verified, target-bearing citation
- **THEN** the marker SHALL be listed in citation metadata as unverified
- **AND** it SHALL be removed from the persisted answer text while valid markers are preserved.

