# adaptive-learning-path-planning Specification

## Purpose
Defines the Stage 1 adaptive learning path planner contract: deterministic rules plus graph search over learner state and ResourceNodes, explainable scoring, visualization payloads, and feedback/correction records without contextual bandit or reinforcement learning.
## Requirements
### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, registered LearningGoal strategy, teacher policy, planning constraints, ranked resource candidates, and bounded repair output where available.

#### Scenario: Planner creates a feasible path
- **WHEN** a student requests a learning path with a time budget and registered learning goal
- **THEN** the planner SHALL infer deficits when evidence exists, otherwise apply the goal's starter-path policy
- **AND** it SHALL filter ResourceNodes and apply prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints for both personalized and starter paths
- **AND** it SHALL return a feasible plan DAG with current node, next nodes, alternatives, estimates, and explanations.

#### Scenario: Planner repairs a graph-driven draft path
- **WHEN** graph search produces a draft path with bounded alternatives
- **THEN** the planner MAY invoke path constraint repair to satisfy prerequisites, time budget, checkpoint policy, terminal validation policy, readiness, and serial/parallel constraints
- **AND** repaired paths and infeasible fallback states SHALL expose explanation metadata rather than hiding constraint failures.

#### Scenario: Planner exposes fallback state
- **WHEN** learner evidence or resource mapping is insufficient for confident personalization
- **THEN** the planner SHALL return a usable low-confidence starter or fallback path state
- **AND** internal diagnostic gaps SHALL be available to authorized teacher/admin diagnostics rather than student default UI.

### Requirement: Objective function is multi-objective
The system SHALL score candidate paths with a multi-objective function rather than optimizing only for speed or score, and it MAY consume ranked ResourceNode candidate sets produced by the governed resource-learner matching layer.

#### Scenario: Candidate resources are scored before path assembly
- **WHEN** the planner compares graph-driven resource candidates for a LearningGoal
- **THEN** it SHALL use ranked candidate explanations or equivalent internal scoring metadata that considers graph coverage, capability contribution, evidence potential, learner fit, accessibility, freshness, time cost, cognitive load, readiness, and constraints
- **AND** it SHALL expose reason metadata for selected and rejected resources or path alternatives.

### Requirement: Stage 1 planner excludes contextual bandit and RL
The system SHALL generate Stage 1 MVP paths without contextual bandit, reinforcement learning, or long-horizon hybrid policies.

#### Scenario: Stage 1 planner runs
- **WHEN** Stage 1 path planning is active
- **THEN** rules plus graph search SHALL produce feasible paths and deterministic explanation metadata
- **AND** contextual bandit SHALL NOT be required for a feasible path or visualization.

#### Scenario: Repair runs in Stage 1
- **WHEN** path constraint repair is enabled
- **THEN** it SHALL remain a deterministic or solver-bounded feasibility step after candidate filtering and ranking
- **AND** it SHALL NOT introduce contextual bandit, reinforcement learning, or black-box long-horizon policy selection.

### Requirement: Learning path visualization is available
The system SHALL expose path visualization data for map, timeline, and evidence views.

#### Scenario: Map view data is requested
- **WHEN** a student or authorized teacher opens the path map
- **THEN** the response SHALL include main path, branch paths, current node, completed nodes, risk nodes, blocked nodes, and alternatives.

#### Scenario: Evidence view data is requested
- **WHEN** a user inspects why a node was recommended
- **THEN** the response SHALL include evidence basis, confidence, source coverage, learner-state deficits, prerequisite reasons, teacher policy, and alternative nodes.

### Requirement: Path execution feedback is captured
The system SHALL capture path adoption, completion, deviation, correction, explanation clicks, and helpfulness feedback, and path execution SHALL produce a learner-visible timeline plus teacher-visible evidence summary.

#### Scenario: Path checkpoint is recorded
- **WHEN** a learner completes, skips, deviates from, or receives an intervention for a path node
- **THEN** the path center SHALL show checkpoint state, evidence confidence, and next action
- **AND** teacher-facing summaries SHALL aggregate checkpoint, deviation, and intervention evidence without exposing private raw answers.

#### Scenario: Student deviates from path
- **WHEN** a student skips, replaces, or abandons a path node
- **THEN** the system SHALL record the deviation with context
- **AND** the planner SHALL be able to generate a correction path without losing the prior evidence chain.

### Requirement: Planner consumes the control-correction seed graph
The system SHALL be able to generate candidate paths from the audited control-correction ResourceNode seed graph.

#### Scenario: Feasible control-correction path is requested
- **WHEN** the planner receives a `control-correction` goal, learner-state slice, time budget, and teacher policy
- **THEN** it SHALL select only path-eligible seed nodes whose prerequisites, availability, privacy, terminal constraints, and evidence instrumentation pass audit
- **AND** it SHALL return a candidate path that includes explanatory reasons and a terminal validation strategy when sufficient evidence exists.

#### Scenario: Required terminal validation is unavailable
- **WHEN** no audited simulation or Arena validation node is available for the requested path constraints
- **THEN** the planner SHALL return a fallback or low-confidence path state
- **AND** it SHALL explain the missing resource or mapping gap instead of silently ending with a non-validation node.

### Requirement: Control-correction path rounds are persisted
The system SHALL persist control-correction paths through the generic path-round contract while preserving control-correction validation metadata.

#### Scenario: Control-correction path round is created
- **WHEN** a student or authorized service creates a `control-correction` path
- **THEN** the persisted path SHALL satisfy the generic path-round contract
- **AND** it SHALL include goal reference, planner version, status, current node, learner-state input reference, path payload, explanation payload, alternative payload, entry resource node, terminal validation type, terminal validation context, and last execution metadata.

#### Scenario: Control-correction path round is resumed
- **WHEN** a student resumes an active `control-correction` path
- **THEN** the system SHALL restore current node, completed nodes, failed nodes, alternatives, terminal validation state, and evidence confidence markers
- **AND** it SHALL preserve the evidence chain used to generate the original path.

### Requirement: Path execution, deviations, and interventions are append-only records
The system SHALL record path execution, deviation, and intervention activity as append-only records linked to the owning path.

#### Scenario: Node execution is recorded
- **WHEN** a path node starts, completes, fails, or is abandoned
- **THEN** the system SHALL record node id, resource type, status, timestamps, evidence references, derived lift metadata, and related simulation or Arena references where available.

#### Scenario: Student deviates from path
- **WHEN** a student skips, times out, manually jumps, requests help, or encounters a resource failure
- **THEN** the system SHALL record the deviation type, context, prior node, target node if any, and evidence confidence
- **AND** the planner SHALL be able to use this state when generating a correction path.

#### Scenario: Konling intervention is recorded
- **WHEN** Konling proposes a diagnosis, hint, rollback, fallback path, or reflection prompt for a path
- **THEN** the system SHALL record intervention kind, cited evidence, suggested action, student outcome, and privacy-safe summary.

### Requirement: Legacy recommendation compatibility is preserved
The system SHALL preserve existing recommendation and lightweight path consumers while persisted path rounds are introduced.

#### Scenario: Legacy recommendation consumer reads output
- **WHEN** a legacy consumer expects a `LearningRecommendation` or lightweight path summary
- **THEN** the system SHALL provide compatible output from existing data or a documented path-summary mapper
- **AND** disabling the control-correction path feature SHALL not break existing adaptive practice, profile, recommendation, or chat surfaces.

### Requirement: Control-correction paths use simulation and Arena terminal validation
The system SHALL determine control-correction path completion from configured simulation and Arena validation evidence rather than resource views alone, and terminal validation SHALL be summarized as a product-visible result.

#### Scenario: Terminal validation succeeds or fails
- **WHEN** a path reaches simulation or Arena terminal validation
- **THEN** the path center SHALL show validation source, result state, evidence references, and remediation or completion next action
- **AND** validation preview evidence SHALL NOT be represented as official Arena success.

#### Scenario: Terminal validation succeeds
- **WHEN** a student completes the required simulation and Arena validation nodes with governed evidence that meets the path policy
- **THEN** the path SHALL mark terminal validation as satisfied and may transition to completed
- **AND** the completion state SHALL reference privacy-safe evidence ids, provenance, replay confidence, and validation policy version.

#### Scenario: Terminal validation fails
- **WHEN** simulation metrics fail, Arena submission is invalid or low-scoring under policy, replay confidence is insufficient, or required evidence is missing
- **THEN** the path SHALL record a failed or low-confidence validation state
- **AND** it SHALL trigger an alternative path, fallback node, Konling correction, or teacher-visible risk marker according to policy.

#### Scenario: Validation node is only preview evidence
- **WHEN** the available Arena or simulation result is preview-only
- **THEN** the path SHALL mark the result as preview-only context unless policy explicitly allows preview validation
- **AND** it SHALL NOT present preview-only evidence as official evaluation, leaderboard, or hard terminal authority.

### Requirement: Planner supports explicit policy families
The adaptive learning path planner SHALL support explicit path policy families for registered learning goals.

#### Scenario: Foundation remediation path is requested
- **WHEN** a foundation-remediation policy is requested
- **THEN** the planner SHALL prioritize prerequisite repair, concept cards, short exercises, and low cognitive-load resources before terminal validation.

#### Scenario: Simulation-driven path is requested
- **WHEN** a simulation-driven policy is requested
- **THEN** the planner SHALL prioritize simulation, Arena, experiment, and reflection resources while preserving required prerequisites and evidence confidence limits.

#### Scenario: Sprint-correction path is requested
- **WHEN** a sprint-correction policy is requested
- **THEN** the planner SHALL prioritize the highest-impact weak indicators within the time budget and expose the tradeoff against breadth.

### Requirement: Displayed paths are meaningfully distinct
When multiple path styles are shown together, the system SHALL verify that they are meaningfully different.

#### Scenario: Multi-path bundle is generated
- **WHEN** a student is shown multiple path styles for the same goal
- **THEN** the bundle SHALL include overlap, modality mix, estimated effort, and terminal validation difference metrics
- **AND** resource overlap SHALL stay below the configured threshold unless a low-resource fallback is returned.

### Requirement: Control-correction planner returns three path styles
The path planner SHALL provide a directly comparable three-style path bundle for control-correction diagnosis when sufficient resources and evidence exist.

#### Scenario: Three-style bundle is generated
- **WHEN** a student opens the control-correction path center from diagnosis or adaptive practice
- **THEN** the system SHALL display available path styles with style id, policy family, target deficits, estimated effort, resource mix, terminal validation strategy, evidence basis, and limitations
- **AND** unavailable or insufficient path diversity SHALL be represented as fallback state rather than three cosmetic cards.

#### Scenario: Resources are insufficient
- **WHEN** the planner cannot produce meaningfully distinct path options
- **THEN** it SHALL return an explicit low-resource or low-confidence fallback
- **AND** it SHALL NOT show three cosmetic variants with materially identical resources.

### Requirement: Path choice writes back as preference evidence
Student path selection and outcomes SHALL update governed preference and strategy evidence, and selection SHALL be visible without inflating mastery directly.

#### Scenario: Student selects a path style
- **WHEN** a student chooses a displayed path style
- **THEN** the system SHALL record selected style, rejected alternatives, diagnosis snapshot reference, resource mix, and rationale metadata
- **AND** the choice SHALL be available to learner-state preference features.
- **AND** the path center SHALL show the selection history
- **AND** the original selection alone SHALL NOT be treated as mastery evidence.

#### Scenario: Path execution changes mastery
- **WHEN** the selected path is executed
- **THEN** completion, deviation, terminal validation, and helpfulness evidence MAY affect mastery, risk, and strategy features according to their own evidence quality
- **AND** the original selection alone SHALL NOT be treated as mastery evidence.

### Requirement: Path bundles remain explainable
Displayed path bundles SHALL expose why options differ and what tradeoffs they make.

#### Scenario: User compares path options
- **WHEN** a student or authorized teacher compares path options
- **THEN** the response SHALL include overlap, modality mix, estimated effort, expected target lift, terminal validation difference, and evidence limitations
- **AND** all personalized claims SHALL cite authorized diagnosis, learner-state, path, or resource evidence.

#### Scenario: Diagnosis and Konling consume path option context
- **WHEN** diagnosis surfaces or the Konling path-advisor read the current control-correction path context
- **THEN** they SHALL receive sanitized path option summaries and selection history
- **AND** the context SHALL expose evidence basis and terminal validation references without private raw traces or hidden prompt payloads.

### Requirement: Planner supports registered learning goals
The adaptive path planner SHALL generate learning paths for registered LearningGoals with graph-driven context.

#### Scenario: Graph-driven LearningGoal is requested
- **WHEN** a student requests a path for a `path-ready` LearningGoal with an ExpandedGoalSubgraph
- **THEN** the planner SHALL consume the LearningGoal id, LearningGoal version, K/A/Q objective boundary, K/A/Q graph targets, prerequisite policy, allowed resource mix, evidence policy, checkpoint policy, terminal validation policy, and version refs
- **AND** it SHALL return executable path options with current node, alternatives, estimated time, evidence limits, graph/resource limitations, and student-facing rationale.

### Requirement: Cold-start learners receive executable starter paths
The planner SHALL treat cold start as a supported generation state, not as a no-path failure.

#### Scenario: Cold-start learner requests a graph-driven path
- **WHEN** a learner with no usable evidence requests a graph-driven LearningGoal path
- **THEN** the planner SHALL use the LearningGoal policy, resource coverage, ResourceNode readiness, and graph prerequisites to return executable starter options where resources are available
- **AND** low evidence SHALL be exposed as a limitation rather than clearing the path.

### Requirement: Generic path rounds are persisted
The system SHALL persist learning path rounds across registered goals.

#### Scenario: Graph-driven path round is persisted
- **WHEN** a generated graph-driven path option is created or selected
- **THEN** the persisted path SHALL include owner user, goal id, goal version, graph version, resource registry or projection version, overlay version where used, planner version, status, selected option, current node, path payload, explanation payload, alternative payload, and evidence window references
- **AND** it SHALL be resumable without recomputing the original graph/resource basis.

### Requirement: Generated paths use governed resource nodes
Adaptive path generation SHALL use only audited resource nodes and checkpoint nodes with registered path semantics, even when ranking consumes retrieval or citation projections as semantic signals.

#### Scenario: Ranked retrieval chunk lacks ResourceNode audit
- **WHEN** a RetrievalChunk or CitationTarget ranks highly for graph relevance
- **THEN** the planner SHALL NOT turn it into a PathNode unless an audited ResourceNode or checkpoint contract authorizes it
- **AND** diagnostics SHALL distinguish retrieval relevance from path eligibility.

### Requirement: Planner accepts Konling path-generation requests
The adaptive path planner SHALL accept governed Konling tool requests as one path generation input channel.

#### Scenario: Konling invokes graph-driven planner
- **WHEN** a governed Konling path tool calls the planner with graph-driven context
- **THEN** the planner SHALL consume only server-owned LearningGoal, graph, learner, class, resource, path, and privacy context
- **AND** client text SHALL NOT expand accessible resources, evidence, graph nodes, or permissions.

### Requirement: Path execution state distinguishes review, continuation, skip, and return
Path execution records SHALL preserve distinct learner actions for execution and history views.

#### Scenario: Completed node is continued
- **WHEN** a student continues interacting with a completed node
- **THEN** the system SHALL record a new governed interaction or evidence event
- **AND** it SHALL NOT count the node as newly completed a second time.

#### Scenario: Unfinished node is skipped
- **WHEN** a student skips an unfinished node
- **THEN** the system SHALL record a path deviation with prior node, skipped node, reason context where available, timestamp, and return eligibility
- **AND** the path SHALL allow the student to return later unless policy forbids the node.

#### Scenario: Checkpoint outcome is recorded
- **WHEN** a checkpoint passes, fails, is retried, or requires review
- **THEN** the system SHALL record outcome, evidence references, and next-action effect
- **AND** the history UI SHALL be able to show the result without exposing private raw answers.

### Requirement: Planner gates active path nodes by learner readiness
The adaptive path planner SHALL evaluate learner readiness before placing a ResourceNode into the immediately executable portion of a generated path.

#### Scenario: Student lacks competency for a heavy node
- **WHEN** a student requests a path and the learner-state slice is below a node's readiness threshold
- **THEN** the planner SHALL exclude that node from `activeNodeIds`
- **AND** it SHALL include preparation nodes or fallback nodes before the locked node when such nodes are available
- **AND** it SHALL keep the locked node out of current or next executable actions.

#### Scenario: Zero-competency control-correction learner requests a path
- **WHEN** student `20230010102601` or an equivalent learner has zero control-modeling and parameter-design competency
- **THEN** Arena and other terminal heavy nodes SHALL NOT be returned as immediate current nodes
- **AND** the first executable option SHALL start with preparation, knowledge, guided practice, diagnosis, or low-risk resource nodes.

### Requirement: Path options carry active and locked readiness structure
Generated path options SHALL distinguish active nodes, locked nodes, readiness summaries, and unlock conditions.

#### Scenario: Option contains future heavy work
- **WHEN** a path option includes Arena, simulation, control workbench, or terminal validation as future work
- **THEN** the option SHALL include `activeNodeIds`, `lockedNodeIds`, `readinessSummary`, and student-facing unlock messages
- **AND** downstream selection and execution SHALL use those fields instead of recomputing readiness from visible labels.

#### Scenario: Dependent node readiness changes
- **WHEN** a completed preparation node or complex-node result satisfies a readiness condition
- **THEN** the planner SHALL be able to unlock the dependent node without discarding the original path history.

### Requirement: Planner consumes structured generation requests
Adaptive path generation SHALL consume structured user-editable request parameters rather than relying on fixed preset goals or opaque chat text.

#### Scenario: Generation request is submitted
- **WHEN** the path center submits a generation request
- **THEN** the planner SHALL receive goal id, time budget, difficulty rhythm, resource preferences, checkpoint preference, external-resource permission, natural-language intent summary, excluded nodes, preferred style, and request timestamp
- **AND** it SHALL preserve those inputs in auditable path request metadata.

#### Scenario: Low-resource generation is requested
- **WHEN** available resources cannot produce three fully executable distinct paths
- **THEN** the planner SHALL still return a comparison bundle with honest preparation-first, locked-future, or evidence-needed states where possible
- **AND** it SHALL NOT fabricate three materially identical path variants.

### Requirement: Planner returns display-ready path option bundles
The planner SHALL return path options with fields needed by the generation panel and comparison view.

#### Scenario: Path options are generated
- **WHEN** the planner returns options to the path center
- **THEN** each option SHALL include style id, label, node ids, active node ids, locked node ids, readiness summary, resource mix, estimated minutes, checkpoint node ids, terminal validation node ids, student-facing reason, expected outcome, and risk note.

### Requirement: Complex path nodes require typed outcome references
Adaptive path execution SHALL bind complex-node completion to typed outcome references before dependent path nodes advance.

#### Scenario: Adaptive assessment node completes
- **WHEN** an adaptive assessment node is marked completed for a path
- **THEN** the execution record SHALL include an adaptive assessment reference with item count, correctness, ability change, and weak-knowledge summary available to the path result card.

#### Scenario: Simulation or workbench node completes
- **WHEN** a simulation or control workbench node is marked completed for a path
- **THEN** the execution record SHALL include a simulation or control workbench reference with run id, trace or replay reference, key metrics, validation status, and evidence provenance.

#### Scenario: Arena node completes
- **WHEN** an Arena node is marked completed for a path
- **THEN** the execution record SHALL include an Arena submission reference with submission id, score, validity, and evaluation summary
- **AND** preview-only Arena evidence SHALL NOT be represented as official terminal validation unless policy explicitly permits it.

### Requirement: Missing complex-node results block dependent advancement
The path planner SHALL not advance to a node whose readiness depends on a complex-node result until the required result reference is bound.

#### Scenario: Required result is not bound
- **WHEN** a path node requires an assessment, simulation, workbench, or Arena result and the result reference is missing
- **THEN** dependent nodes SHALL remain blocked or locked
- **AND** the path activity SHALL record the missing binding for governance review.

#### Scenario: Result binding arrives later
- **WHEN** the missing result reference is later attached to the execution record
- **THEN** the planner SHALL re-evaluate dependent readiness without losing prior skip, return, review, or continued-interaction history.

### Requirement: Path launch context is execution-owned
Adaptive path execution SHALL create and preserve a normalized launch context whenever a path node opens an external resource route.

#### Scenario: Launch context is created
- **WHEN** a path node launch target leaves the adaptive path center
- **THEN** the system SHALL derive source, goal id, path id, node id, route intent, return href, and resource type from the selected path execution state
- **AND** it SHALL pass that context to the target route without treating client-only path ownership hints as authorization.

#### Scenario: Launch context is consumed
- **WHEN** a target resource, course runtime, simulation, workbench, Arena, or assessment page receives a path launch context
- **THEN** it SHALL preserve that context for return navigation
- **AND** any path read or write using that context SHALL validate that the authenticated user is authorized for the path.

### Requirement: Path-launched resources write completion through the path execution contract
Every path-launched resource category SHALL write governed execution completion before it can advance dependent path state.

#### Scenario: Simple interactive resource completes
- **WHEN** a path-launched interactive resource, knowledge card, reflection, or non-complex lesson activity completes
- **THEN** the system SHALL write a `completed` execution event for the owning path and node
- **AND** the event SHALL include resource type, completion timestamp, idempotency key, and privacy-safe evidence references where available.

#### Scenario: Complex resource completes
- **WHEN** a path-launched adaptive assessment, simulation, control workbench, or Arena node completes
- **THEN** the system SHALL write a `completed` execution event with the typed outcome reference required by that node type
- **AND** dependent path nodes SHALL not advance until that reference is bound or the path policy explicitly permits preview or pending evidence.

#### Scenario: Completion is replayed or reviewed
- **WHEN** a student reviews, continues, or returns to an already completed node
- **THEN** the system SHALL record a distinct review, continued-interaction, or return activity
- **AND** it SHALL NOT count the original node completion a second time.

### Requirement: Latest path recovery uses path truth before generated defaults
Adaptive path recovery SHALL restore selected or completed path rounds from path persistence before showing generated defaults.

#### Scenario: Active path is recoverable
- **WHEN** a student has an active path round and opens the path center without a path id
- **THEN** the system SHALL read the latest authorized active path round for the requested or supported default goal
- **AND** it SHALL return enough structure for the UI to render selected option, current node, completed nodes, alternatives, and evidence timeline.

#### Scenario: Completed path is recoverable
- **WHEN** the latest authorized path round is completed
- **THEN** the system SHALL return the completed path structure and summary fields needed for a learner-visible completion view
- **AND** it SHALL NOT collapse the completed path into only a generic history event.

#### Scenario: Learner-state read model is stale
- **WHEN** learner-state path context is missing, stale, or temporarily unavailable but a recent authorized path round exists
- **THEN** latest path recovery SHALL still be able to restore the selected path from `LearningPath` persistence
- **AND** the system SHALL expose the read-model limitation separately from the path execution truth.

### Requirement: Path generation uses PlanningUnit projections
Adaptive path generation SHALL use PlanningUnit projections as executable learning actions derived from audited ResourceNodes or generated checkpoint contracts.

#### Scenario: Path option is generated from resources
- **WHEN** the planner selects a resource-backed path node
- **THEN** the node SHALL identify its source ResourceNode or checkpoint contract, knowledge target, capability target where available, prerequisite basis, estimated time, cognitive load, evidence behavior, and launch binding
- **AND** ResourceNode audit and eligibility SHALL remain authoritative for path inclusion.

#### Scenario: Retrieval chunk is not path-plannable
- **WHEN** a RetrievalChunk matches the learner's current need
- **THEN** it MAY inform explanation or resource discovery
- **AND** it SHALL NOT become a PathNode unless an audited PlanningUnit and ResourceNode or checkpoint contract exists.

#### Scenario: Active execution contracts are present
- **WHEN** PlanningUnit-based nodes are launched, resumed, selected, skipped, or completed
- **THEN** the implementation SHALL preserve the path launch context, selected option adoption, latest path recovery, and completion writeback contracts owned by active path changes.

### Requirement: LearningGoal baseline resource coverage constrains graph-driven planning
The adaptive path planner SHALL use human-confirmed baseline resource coverage before treating an in-scope path-ready LearningGoal as production-generatable.

#### Scenario: Baseline-covered LearningGoal is requested
- **WHEN** a student requests a graph-driven path for an in-scope path-ready LearningGoal with baseline resource coverage
- **THEN** the planner SHALL select only human-confirmed, audited ResourceNodes or checkpoint contracts
- **AND** the path SHALL include concept support, diagnostic or evidence gathering, practice, checkpoint, and remediation or reflection where the LearningGoal policy requires them.

#### Scenario: LearningGoal baseline is incomplete
- **WHEN** a requested in-scope LearningGoal lacks required baseline resource categories
- **THEN** the planner SHALL return a low-resource limitation or blocked production writeback according to policy
- **AND** it SHALL NOT fabricate path diversity from unreviewed, provisional, retrieval-only, or citation-only resources.

#### Scenario: Heavy baseline node requires readiness
- **WHEN** a baseline path candidate includes simulation, Arena, control workbench validation, project, or terminal checkpoint resources
- **THEN** the planner SHALL respect readiness metadata before making the node current or immediately executable
- **AND** students below readiness SHALL receive fallback or preparation nodes first.

#### Scenario: Baseline coverage payload is exposed
- **WHEN** planner diagnostics or coverage surfaces report LearningGoal baseline state
- **THEN** the payload SHALL include denominator, source window, graph/goal/resource version refs, limitation reasons, and role-safe explanation fields
- **AND** student-facing payloads SHALL not expose internal resource governance diagnostics.

### Requirement: Reviewed quiz coverage constrains readiness and personalization
The adaptive path planner SHALL use reviewed quiz coverage and governed quiz outcomes before treating a LearningGoal as fully testable, personalized, or ready for high-complexity unlocks.

#### Scenario: Diagnostic quiz coverage exists
- **WHEN** a learner requests a path for a LearningGoal with reviewed diagnostic quiz coverage
- **THEN** the planner MAY include a precheck or evidence-gathering quiz early in the path
- **AND** the quiz SHALL expose governed outcome refs suitable for later personalization.

#### Scenario: Quiz unlocks a high-complexity resource
- **WHEN** quiz evidence is used to unlock simulation, Arena, control workbench validation, project, or terminal checkpoint nodes
- **THEN** the unlock SHALL require reviewed K/A/Q question metadata and governed outcome refs
- **AND** generated-only or provisional quiz evidence SHALL not satisfy the readiness gate.

#### Scenario: LearningGoal quiz coverage is insufficient
- **WHEN** a LearningGoal lacks reviewed diagnostic or checkpoint quiz coverage required by its policy
- **THEN** the planner SHALL expose a coverage limitation
- **AND** it SHALL not present the LearningGoal as fully testable or high-confidence personalized.

#### Scenario: Quiz outcome materialization is incomplete
- **WHEN** quiz evidence lacks question snapshot, attempt key, scoring version, denominator, dedupe key, confidence, or LearningFact eligibility fields
- **THEN** the planner SHALL treat the result as insufficient for readiness and terminal validation
- **AND** it SHALL preserve the attempt only as limited practice history.

### Requirement: Planner explains SAR candidate adoption and rejection
The adaptive path planner SHALL expose how SAR-associated candidates affected path planning.

#### Scenario: SAR candidates are evaluated
- **WHEN** path planning receives SAR candidate refs and trace metadata
- **THEN** the resulting path explanation SHALL include seed entities, candidate resource ids, selected candidate ids, rejected candidate ids, and rejection reasons
- **AND** the path SHALL remain valid when SAR is disabled or unavailable.

### Requirement: Planner can select completed core resource types
The adaptive path planner SHALL be able to select reviewed core teaching resources for registered LearningGoals when those resources pass ResourceNode audit.

#### Scenario: Registered LearningGoal has reviewed core resources
- **WHEN** a student requests a path for a registered LearningGoal whose core resources have reviewed path readiness
- **THEN** the planner SHALL consider interactive lessons, knowledge cards, quizzes, simulations, exercises, and other reviewed core resource types according to goal policy and learner state
- **AND** it SHALL expose selected and rejected resource reasons without relying on hard-coded goal names.

### Requirement: Planner can select reviewed long-form sections
The adaptive path planner SHALL consider reviewed textbook and reference sections as path resources when they satisfy LearningGoal policy and ResourceNode audit.

#### Scenario: Long-form section matches a LearningGoal
- **WHEN** a reviewed textbook or reference section covers a requested LearningGoal and passes path readiness
- **THEN** the planner MAY select it as a learning resource, remediation resource, enrichment resource, or prerequisite repair resource according to its reviewed path role
- **AND** it SHALL use lower-level chunks only as citation and rationale support unless they are separately reviewed as PathNodes.

### Requirement: Path planning respects LearningGoal assessment coverage completeness
The adaptive path planner SHALL consume LearningGoal assessment coverage state before treating a path as fully personalized, checkpoint-backed, or high-confidence.

#### Scenario: Complete assessment coverage exists
- **WHEN** a learner requests a path for a LearningGoal with complete reviewed assessment item coverage
- **THEN** the planner MAY include precheck, practice, checkpoint, readiness, and remediation assessment nodes according to policy
- **AND** the generated path SHALL cite the coverage matrix version used for those assessment nodes.

#### Scenario: Assessment coverage is incomplete
- **WHEN** a learner requests a path for a LearningGoal whose reviewed item coverage is incomplete
- **THEN** the planner SHALL expose a coverage limitation or block high-confidence personalization according to policy
- **AND** it SHALL NOT fabricate checkpoint coverage from generated, template, unreviewed, or deprecated items.
