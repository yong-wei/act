# adaptive-learning-path-planning Specification

## Purpose
Defines the Stage 1 adaptive learning path planner contract: deterministic rules plus graph search over learner state and ResourceNodes, explainable scoring, visualization payloads, and feedback/correction records without contextual bandit or reinforcement learning.
## Requirements
### Requirement: Path planner generates constrained explainable paths
The system SHALL generate adaptive learning paths from learner state, the ResourceNode graph, registered LearningGoal strategy, teacher policy, planning constraints, ranked resource candidates, and bounded repair output where available. For Projection-bound formal paths, the planner MUST traverse only ACT Teaching Projection `ACT_TEACHING` prerequisites with `REQUIRED` strength for hard dependencies, exclude learner-mastered nodes, topologically order the remainder, and choose current accessible Teaching Projection resources. ActKG engineering relations and textbook/lesson order MAY be rationale only and MUST NOT become hard edges.

#### Scenario: Planner creates a feasible path
- **WHEN** a student requests a learning path with a time budget and registered learning goal
- **THEN** the planner SHALL infer deficits when evidence exists, otherwise apply the goal's starter-path policy
- **AND** it SHALL filter ResourceNodes and apply prerequisites, availability, teacher policy, privacy, device, risk-intervention, and time constraints for both personalized and starter paths
- **AND** it SHALL return a feasible plan DAG with current node, next nodes, alternatives, estimates, and explanations.

#### Scenario: Goal has required prerequisites
- **WHEN** a path-eligible goal has a valid current Projection and required prerequisite DAG
- **THEN** the planner SHALL reverse-traverse unmet REQUIRED nodes and return a deterministic topological path
- **AND** each emitted node SHALL have at least one accessible projected resource

#### Scenario: Engineering relation is present
- **WHEN** an ActKG engineering relation connects two nodes but no ACT REQUIRED edge exists
- **THEN** the planner SHALL not add that relation as a prerequisite
- **AND** it SHALL preserve the relation only as optional explanation/context

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
Displayed path bundles SHALL expose why two current options differ and what measurable trade-offs they make. A comparison SHALL be derived deterministically from the two specified options in the same saved path version and SHALL NOT alter, reorder or regenerate either option.

#### Scenario: User compares path options
- **WHEN** a student or authorized teacher compares two valid options from the same current saved path
- **THEN** the response SHALL identify both options and include ordered common nodes, ordered option-only nodes, shared-node order differences, modality or resource mix, estimated effort, checkpoint and readiness facts, locked nodes, terminal validation differences, trade-offs, and evidence limitations
- **AND** personalized claims SHALL be limited to authorized diagnosis, learner-state, path, or resource evidence.

#### Scenario: Compared options have no material difference
- **WHEN** the two specified options have the same ordered nodes and no material metric difference
- **THEN** the response SHALL state that no material difference is present
- **AND** it SHALL retain the compared option identities so the result remains auditable.

#### Scenario: Stored option facts are insufficient
- **WHEN** either option lacks the ordered node identities or student-safe node summaries required for a reliable comparison
- **THEN** the response SHALL state that a reliable difference explanation is unavailable and identify the comparison limitation
- **AND** it SHALL NOT replace the missing facts with generic or model-inferred claims.

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
The planner SHALL treat cold start and trusted `NO_EVIDENCE` as supported
generation states, not as no-path failures.

#### Scenario: Cold-start learner requests a graph-driven path
- **WHEN** a learner with no usable trusted evidence or a current `NO_EVIDENCE` portrait requests a graph-driven LearningGoal path
- **THEN** the planner SHALL use the LearningGoal policy, resource coverage, ResourceNode readiness, and graph prerequisites to return executable starter options where resources are available
- **AND** low evidence SHALL be exposed as a limitation rather than clearing the path
- **AND** the planner SHALL NOT construct personalization claims from legacy portrait data.

### Requirement: Generic path rounds are persisted
The system SHALL persist learning path rounds across registered goals.

#### Scenario: Graph-driven path round is persisted
- **WHEN** a generated graph-driven path option is created or selected
- **THEN** the persisted path SHALL include owner user, goal id, goal version, graph version, resource registry or projection version, overlay version where used, planner version, status, selected option, current node, path payload, explanation payload, alternative payload, and evidence window references
- **AND** it SHALL be resumable without recomputing the original graph/resource basis.

### Requirement: Generated paths use governed resource nodes
Adaptive path generation SHALL use only audited resource nodes and checkpoint nodes with registered path semantics, even when ranking consumes retrieval or citation projections as semantic signals. Path nodes MUST reference registered ResourceNodes from the active Teaching Projection and MUST preserve resource role, scope, source/provenance, and Projection identity. The planner MUST NOT synthesize a PathNode directly from a raw ActKG node, engineering edge, or unreviewed textbook locator.

#### Scenario: Ranked retrieval chunk lacks ResourceNode audit
- **WHEN** a RetrievalChunk or CitationTarget ranks highly for graph relevance
- **THEN** the planner SHALL NOT turn it into a PathNode unless an audited ResourceNode or checkpoint contract authorizes it
- **AND** diagnostics SHALL distinguish retrieval relevance from path eligibility.

#### Scenario: Projected lesson is selected
- **WHEN** a governed lesson or interactive resource is selected for a Canonical prerequisite
- **THEN** the path node SHALL carry its ResourceNode identity and launch target
- **AND** the path rationale SHALL identify the Canonical and prerequisite evidence

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
The adaptive path planner SHALL evaluate learner readiness using portrait v2
learner-state signals before placing a ResourceNode into the immediately
executable portion of a generated path. Every formal path node MUST have `pathEligible=true`, a valid current Authority/Projection identity, and at least one accessible projected resource. A node with no resource or an unresolved required binding MUST be excluded or returned as an explicit blocked diagnostic.

#### Scenario: Student lacks readiness for a heavy node
- **WHEN** a student requests a path and the portrait v2 learner-state slice is below a node's readiness threshold
- **THEN** the planner SHALL exclude that node from `activeNodeIds`
- **AND** it SHALL include preparation nodes or fallback nodes before the locked node when such nodes are available
- **AND** it SHALL keep the locked node out of current or next executable actions.

#### Scenario: Node has no accessible resource
- **WHEN** an unmet prerequisite node has no accessible lesson, handout, step, card, textbook, or other projected resource
- **THEN** the planner SHALL not emit an executable node
- **AND** it SHALL report the exact readiness blocker

#### Scenario: Optional card is missing
- **WHEN** a node has an accessible handout/step but no optional card
- **THEN** the node SHALL remain path-eligible
- **AND** the planner SHALL choose the other resource and annotate card absence

#### Scenario: Low-readiness control-correction learner requests a path
- **WHEN** student `20230010102601` or an equivalent learner has low portrait v2 readiness for control modeling/representation and controller design/synthesis
- **THEN** Arena and other terminal heavy nodes SHALL NOT be returned as immediate current nodes
- **AND** the first executable option SHALL start with preparation, knowledge, guided practice, diagnosis, or low-risk resource nodes
- **AND** any values derived from legacy six-dimensional compatibility mapping SHALL be identified in diagnostics.

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
The adaptive path planner SHALL use review-confirmed baseline resource coverage before treating an in-scope path-ready LearningGoal as production-generatable.

#### Scenario: Baseline-covered LearningGoal is requested
- **WHEN** a student requests a graph-driven path for an in-scope path-ready LearningGoal with baseline resource coverage
- **THEN** the planner SHALL select only review-confirmed, audited ResourceNodes or checkpoint contracts
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

### Requirement: Path assessment nodes consume catalog-backed outcome refs
Adaptive path execution SHALL bind assessment node completion to catalog-backed outcome refs when the node is used for readiness, checkpoint, remediation, or terminal-validation support.

#### Scenario: Assessment node completes
- **WHEN** a path-owned adaptive assessment node is completed
- **THEN** its execution record SHALL include selected catalog item refs, assessment stage, reviewed coverage matrix version, score summary, ability or mastery effect, weak target summary, and evidence authority
- **AND** downstream node readiness SHALL use those typed outcome refs instead of free-form quiz labels.

#### Scenario: Provisional answer exists
- **WHEN** a provisional or generated low-stakes answer exists in the learner history
- **THEN** the planner MAY use it as limited practice context
- **AND** it SHALL NOT treat it as satisfying readiness, checkpoint, heavy-node unlock, or terminal-validation requirements.

### Requirement: Planner respects evidence-lineage readiness
The adaptive path planner SHALL distinguish selectable learning resources from resources whose evidence effects are blocked by incomplete lineage.

#### Scenario: Resource lacks evidence lineage
- **WHEN** a resource is otherwise relevant but lacks required evidence-lineage behavior for its planned role
- **THEN** the planner SHALL either select it only as non-mastery learning content with a limitation or reject it for evidence-producing roles
- **AND** it SHALL expose the limitation in authorized diagnostics.

### Requirement: All registered LearningGoals have path-generation diagnostics
The adaptive path planner SHALL expose diagnostics proving every backend-registered LearningGoal can generate paths from governed resources or report a narrowly explained resource gap.

#### Scenario: All-goal path diagnostic runs
- **WHEN** the all-goal path diagnostic runs
- **THEN** it SHALL enumerate LearningGoals from the backend registry rather than hard-coded frontend names
- **AND** it SHALL attempt path generation for every registered goal using audited ResourceNodes, checkpoint nodes, and reviewed resource policies.

#### Scenario: Goal has sufficient governed resources
- **WHEN** a LearningGoal has multiple reviewed resources across compatible resource families
- **THEN** generated paths SHALL include a meaningful governed resource mix according to policy
- **AND** they SHALL NOT collapse to a single-resource fallback or cosmetic variants.

#### Scenario: Goal lacks resources after full audit
- **WHEN** a LearningGoal still lacks sufficient path resources after all resources are classified
- **THEN** diagnostics SHALL report the exact missing graph, resource, evidence, citation, or policy dimension
- **AND** the student-facing path surface SHALL receive an actionable low-resource state rather than a permission-style failure.

### Requirement: Path explanations cite governed selected and supporting resources
Generated path explanations and Konling path advice SHALL cite governed resources used by the planner.

#### Scenario: Path explanation includes resource evidence
- **WHEN** a path option is generated from selected ResourceNodes and supporting citations
- **THEN** its explanation payload SHALL include verified or limitation-marked citation refs for selected and supporting resources
- **AND** citation links SHALL resolve through server-owned citation metadata.

### Requirement: Path planner consumes the unified ResourceNode registry
Adaptive path generation SHALL consume the same governed ResourceNode registry projection used by the resource center and data-completeness helper.

#### Scenario: Planner loads candidate resources
- **WHEN** a student requests a path for any registered LearningGoal
- **THEN** the path-generation entrypoint SHALL load audited ResourceNodes from registered resources, runtime lesson projections, runtime lessons, media and handout dispositions, textbook or reference PlanningUnits, and generated checkpoint contracts through one governed loader
- **AND** it SHALL report registry version, projection version, and candidate counts by resource family.

#### Scenario: Partial registry would hide resources
- **WHEN** a production entrypoint can only see registered resources or textbook catalog rows but runtime projections also exist
- **THEN** diagnostics SHALL report the missing source family
- **AND** the generated path SHALL be marked limited rather than presented as a complete resource-aware recommendation.

#### Scenario: Retrieval-only record ranks highly
- **WHEN** a retrieval chunk, search document, figure, caption, transcript segment, or citation target is relevant to the LearningGoal
- **THEN** the planner MAY use it as ranking or citation support
- **AND** it SHALL NOT promote that record to a PathNode unless an audited ResourceNode or checkpoint contract authorizes path eligibility.

### Requirement: Planner enforces LearningGoal K/A/Q objective boundaries
Graph-driven adaptive path generation SHALL treat LearningGoal K/A/Q objectives and graph targets as the canonical resource boundary.

#### Scenario: LearningGoal boundary is available
- **WHEN** a path-ready LearningGoal is supplied to the planner
- **THEN** candidate ResourceNodes SHALL be admitted only when reviewed metadata matches the LearningGoal knowledge objective, capability objective, quality objective, target graph node, expanded prerequisite subgraph, or policy-required checkpoint/remediation role
- **AND** legacy `knowledgeTargets` or `competencyTargets` SHALL NOT admit an otherwise unrelated resource by themselves.

#### Scenario: Candidate is rejected for objective mismatch
- **WHEN** a high-scoring ResourceNode lacks reviewed K/A/Q, graph, or LearningGoal fit for the requested LearningGoal
- **THEN** the planner SHALL exclude it from executable path options
- **AND** diagnostics SHALL record an objective-boundary mismatch without exposing private learner data.

#### Scenario: Objective coverage is insufficient
- **WHEN** reviewed resources are insufficient after applying LearningGoal K/A/Q boundaries
- **THEN** the planner SHALL return an explicit low-resource limitation
- **AND** it SHALL NOT show cosmetic path variants built from unrelated resources.

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

### Requirement: Path personalization uses portrait v2
Adaptive path planning SHALL use trusted portrait v2 dimensions for
learner-state personalization, weak-dimension targeting, and path rationale.
When learner-state reports `NO_EVIDENCE` or no trusted current portrait, the
planner SHALL fail closed and SHALL NOT read legacy snapshot, feature cache,
old `StudentCompetencySnapshot`, or old competency vector values for
personalization. The planner MAY return a default or non-personalized starter
path.

#### Scenario: Planner ranks resources by learner needs
- **WHEN** the planner personalizes resources for a learner with a current trusted portrait
- **THEN** weak-dimension signals SHALL be read from trusted portrait v2
- **AND** selected-resource rationales SHALL reference portrait v2 dimensions rather than legacy six-dimensional ids.

#### Scenario: Only legacy portrait data exists
- **WHEN** planner input contains only migrated compatibility data and no trusted current portrait
- **THEN** the planner SHALL NOT use that data for personalized scoring or rationale
- **AND** it MAY return a default or starter path with limitation metadata
- **AND** it SHALL NOT silently present compatibility-derived values as native portrait v2 evidence.

#### Scenario: NO_EVIDENCE blocks legacy fallback
- **WHEN** learner-state is `NO_EVIDENCE` or lacks a trusted current portrait
- **THEN** the planner SHALL NOT use legacy snapshot, feature cache, `StudentCompetencySnapshot`, or competency vector for personalization
- **AND** it SHALL return a default or starter path when resources permit
- **AND** personalized claims SHALL NOT be generated from non-trusted data.

### Requirement: All path-ready LearningGoals prove governed resource coverage
Adaptive path diagnostics SHALL prove that each path-ready LearningGoal can generate meaningful governed paths after resource semantic completion.

#### Scenario: Goal has governed resource coverage
- **WHEN** all resource-completion batches are closed
- **THEN** each registered path-ready LearningGoal SHALL generate path options from reviewed ResourceNodes, checkpoints, and supporting citations according to its K/A/Q boundary
- **AND** path options SHALL expose resource mix, overlap, effort, stage coverage, and limitation metadata.

#### Scenario: Goal still has a reviewed blocker
- **WHEN** a LearningGoal cannot generate meaningful governed paths after closure
- **THEN** diagnostics SHALL identify a specific reviewed blocker such as missing source artifact, unresolved route, missing terminal-validation authority, or unavailable evidence lineage
- **AND** the student-facing surface SHALL not show cosmetic identical path options.

### Requirement: Unfinished Legacy paths stop at authority cutover
Every unfinished path whose steps reference Legacy knowledge MUST stop execution at production authority cutover and remain available as an immutable historical record.

#### Scenario: Learner has an active Legacy path
- **WHEN** the cutover transaction runs
- **THEN** the path SHALL enter a read-only stopped state and no Legacy step SHALL execute afterward

### Requirement: Path goals survive without step mapping
The system SHALL preserve the declared learning goal or user intent of a stopped Legacy path without mapping its node sequence to Canonical Objects.

#### Scenario: Goal is preserved
- **WHEN** a stopped path contains a valid goal or intent
- **THEN** that goal SHALL remain available as input to later replanning while the Legacy steps remain historical

### Requirement: Canonical paths are independently regenerated
When a formal ActKG Teaching Projection is active, the planner SHALL generate a new path identity from the preserved goal, current cumulative portrait, version-matched CourseCoverage, reviewed KAQ bindings, and supported Canonical teaching relations. An engineering-only ReleaseSet without formal Teaching Projection MUST NOT satisfy this gate.

#### Scenario: Teaching semantics are ready
- **WHEN** all required Canonical planning inputs pass validation
- **THEN** the planner SHALL create a new path with Canonical IDs and versions and no inherited Legacy progress

#### Scenario: Teaching semantics are unavailable
- **WHEN** the released graph lacks a formal Teaching Projection or required teaching relations
- **THEN** the planner SHALL keep the goal pending and MUST NOT infer a path from engineering relations or Legacy fallback

### Requirement: Planner honors explicit personalized path configuration
The adaptive learning path planner SHALL treat request-level resource preferences, difficulty rhythm, checkpoint preference, and external-resource permission as planning inputs that affect candidate selection or path assembly. Goal boundaries, prerequisites, readiness, teacher policy, privacy, terminal validation, evidence policy, and safety constraints SHALL remain higher-priority constraints.

#### Scenario: Request-level resource preference overrides stored preference
- **WHEN** a request explicitly provides one or more resource types that differ from stored learner preferences
- **THEN** the planner SHALL use the request-level resource types for that generation
- **AND** it SHALL use stored preferences only when the corresponding request value is omitted.

#### Scenario: Feasible contrasting configurations are generated
- **WHEN** the same learner state and resource pool contain feasible alternatives for two contrasting configurations
- **THEN** the resulting paths SHALL differ in at least one non-mandatory instructional resource or in the retained option count
- **AND** a scoring or explanation-text difference alone SHALL NOT satisfy this requirement.

#### Scenario: A requested configuration cannot be fulfilled
- **WHEN** a request-level configuration conflicts with higher-priority constraints or the audited resource pool cannot satisfy it
- **THEN** the planner SHALL retain the higher-priority constraints
- **AND** it SHALL return a structured unmet-configuration reason rather than silently treating the configuration as a weak score signal.

### Requirement: Planner maps free-text intent to governed planning concepts
The planner SHALL accept free-text path intent only through deterministic mappings to supported resource types, difficulty rhythm, checkpoint density, external-resource permission, registered goals, or graph targets. Client text SHALL NOT expand resource access, evidence authority, graph boundaries, or permissions.

#### Scenario: Free-text intent maps to supported concepts
- **WHEN** a student's free-text intent matches supported planning vocabulary
- **THEN** the request SHALL produce typed planning inputs with mapping evidence
- **AND** those inputs SHALL follow the same fulfillment and higher-priority-constraint rules as structured configuration.

#### Scenario: Free-text intent is unsupported or infeasible
- **WHEN** free-text intent cannot be mapped deterministically or cannot be satisfied by audited resources and constraints
- **THEN** the planner SHALL return a structured unmet reason in student-safe form
- **AND** it SHALL NOT pass raw text to an unrestricted semantic planner or claim that the intent changed the path.

### Requirement: Policy bundles select meaningful path alternatives during generation
When generating multiple policy-family options, the planner SHALL generate options in deterministic priority order and avoid the differentiable instructional resources already retained by earlier options. Mandatory prerequisite and terminal-validation resources MAY be shared.

#### Scenario: Later policy option has a feasible alternative
- **WHEN** a later policy family has an alternative path that satisfies all required constraints without reusing every differentiable instructional resource of an earlier retained option
- **THEN** the planner SHALL retain that alternative
- **AND** the bundle SHALL identify its differentiable-resource distinction through its normal comparison data.

#### Scenario: Later policy option has no meaningful alternative
- **WHEN** a later policy family cannot satisfy goal, prerequisite, readiness, terminal-validation, and personalization constraints without cosmetic reuse
- **THEN** the planner SHALL omit that option
- **AND** it SHALL return a student-safe limitation explaining the reduced option count.

#### Scenario: Mandatory nodes are shared
- **WHEN** multiple retained options require the same prerequisite repair or terminal-validation node
- **THEN** the planner MAY retain that shared node in each option
- **AND** it SHALL evaluate meaningful distinction on the remaining differentiable instructional resources.

### Requirement: Planner preserves requested budget when validation is required
The planner SHALL preserve the student's requested time budget as the request constraint. When mandatory terminal validation makes the request infeasible, it SHALL return the minimum executable duration and a structured budget limitation instead of silently increasing the requested budget or removing validation.

#### Scenario: Requested budget is below the executable minimum
- **WHEN** a registered goal requires terminal validation and the requested budget is below the minimum feasible duration
- **THEN** the planner SHALL not generate a path that represents the higher duration as requested
- **AND** it SHALL return the requested duration, the minimum executable duration, and a student-safe corrective action.

### Requirement: Candidate paths preserve aggregate recommendation basis
The adaptive learning path planner SHALL persist a student-safe aggregate recommendation basis snapshot for each formally generated candidate path without changing candidate selection, ranking, or scoring.
#### Scenario: Evidence supports a candidate path recommendation
- **WHEN** a candidate path is generated from learner-state deficits and governed resource nodes
- **THEN** the candidate path SHALL preserve one or more entries that connect an aggregate state summary to a capability or knowledge judgment and the path resources affected by that judgment
- **AND** each entry SHALL use generation-time facts so restoring the saved path does not reinterpret the original recommendation from newer learner state.
- **AND** the snapshot SHALL NOT represent aggregate counts or confidence as event-level evidence provenance.
#### Scenario: Evidence is insufficient for reliable personalization
- **WHEN** the candidate path or a target deficit has insufficient effective evidence
- **THEN** the provenance snapshot SHALL mark the explanation as low confidence and identify course structure, prerequisite policy, and available resources as the fallback basis
- **AND** it SHALL provide a student-safe evidence-gathering action rather than presenting missing evidence as a confirmed weakness.
#### Scenario: Student-safe provenance is produced
- **WHEN** aggregate recommendation basis is serialized for a student-facing candidate path
- **THEN** it SHALL contain only governed display labels, bounded evidence summaries, confidence, affected resource titles or identities, limitations, and a governed evidence-review target
- **AND** it SHALL NOT expose raw answers, private conversations, database identifiers, internal reason codes, raw evidence payloads, or hidden prompt content.

### Requirement: Confirmed correction candidates update only eligible future path nodes
The system SHALL apply a confirmed correction candidate by preserving completed nodes and the current node once execution has entered it, excluding unfinished historical nodes that a governed skip, replacement, or abandonment deviation explicitly marks as no longer applicable, and replacing only eligible adjustable unfinished future nodes. It SHALL preserve existing execution and deviation records and terminal evidence unless the confirmed candidate itself contains a governed future terminal node.

#### Scenario: Current node is in progress
- **WHEN** a learner confirms a correction while the current node is started but not completed
- **THEN** the system SHALL keep the current node and its position unchanged
- **AND** it SHALL apply the candidate only to later eligible unfinished nodes.

#### Scenario: Path has no eligible future node
- **WHEN** a current candidate has no eligible future node that can be safely replaced
- **THEN** the system SHALL reject confirmation as unavailable or conflicted
- **AND** it SHALL not alter the persisted path.

### Requirement: Path execution exposes candidate correction proposals
The system SHALL derive a student-visible candidate correction proposal when a path has a trusted failed checkpoint result or a recorded skip, replacement, or abandonment deviation for its current or unfinished nodes. The candidate proposal SHALL affect only unfinished nodes and SHALL NOT mutate the persisted path, current node, completion state, or deviation record.

#### Scenario: Failed checkpoint has a feasible correction
- **WHEN** a learner has a failed checkpoint and the current governed path and resource facts support a changed unfinished-node sequence
- **THEN** the path journey SHALL expose a candidate correction proposal with a student-visible action to inspect it
- **AND** the persisted path and current node SHALL remain unchanged.

#### Scenario: Deviation has a feasible correction
- **WHEN** a learner records a skip, replacement, or abandonment deviation and a changed unfinished-node sequence can be formed from governed facts
- **THEN** the path journey SHALL expose a candidate correction proposal that identifies the recorded deviation as its trigger
- **AND** it SHALL NOT automatically apply the proposal.

#### Scenario: Recorded deviation takes precedence over a residual failed checkpoint
- **WHEN** a valid recorded skip, replacement, or abandonment deviation exists for unfinished nodes after a checkpoint failure remains in execution metadata
- **THEN** the path journey SHALL derive the candidate from the recorded deviation and identify that deviation as its trigger
- **AND** it SHALL NOT present the residual failed checkpoint as the candidate trigger.

#### Scenario: Correction cannot be generated reliably
- **WHEN** trusted execution facts, eligible governed resources, prerequisite relationships, or a material path difference are insufficient
- **THEN** the path journey SHALL expose a student-safe unavailable reason
- **AND** it SHALL NOT fabricate a correction proposal or alter the existing path.

### Requirement: Candidate correction proposals are explainable and comparable
The system SHALL show a candidate correction proposal with its trigger, node additions, removals, replacements, or ordering changes, supporting learning evidence or prerequisite facts, and estimated effect on remaining work. The comparison SHALL use persisted path and governed resource identities rather than client-supplied ordering or generated content.

#### Scenario: Student inspects a candidate correction proposal
- **WHEN** a learner opens an available candidate correction proposal
- **THEN** the UI SHALL show the original unfinished path alongside the proposed changes, the trigger, supporting facts, and estimated remaining-work effect
- **AND** it SHALL state that the proposal is not applied until the student confirms it through the available decision workflow.

#### Scenario: Candidate has no material difference
- **WHEN** a derived candidate has the same unfinished node identities and order as the persisted path
- **THEN** the system SHALL treat the candidate as unavailable
- **AND** it SHALL NOT present it as a correction.

### Requirement: Recommendation provenance preserves student-safe event references
The planner SHALL attach event references only when a governed event can be proven to support the target judgment used by the candidate path. Each reference MUST contain a stable event type, occurrence time, student-readable summary, and student-safe navigation action, and MUST exclude internal identifiers and raw evidence payloads.

#### Scenario: Governed events support a candidate path judgment
- **WHEN** target-scoped learning events contribute to a deficit or capability judgment used by a candidate path
- **THEN** the persisted recommendation provenance includes at most three most-recent student-safe event references for that target
- **AND** each reference identifies the affected judgment and the path nodes or resources selected from it

#### Scenario: Recent event did not participate in planning
- **WHEN** a recent learning event is not part of the target-scoped evidence used by the planner
- **THEN** the event is not included in recommendation provenance

#### Scenario: Only aggregate or restricted evidence is available
- **WHEN** a target judgment is backed only by aggregate snapshots, feature caches, restricted AI evidence, or unresolvable source references
- **THEN** recommendation provenance contains no fabricated event reference
- **AND** records an explicit limitation that event-level evidence cannot be verified

#### Scenario: Student-safe provenance is serialized
- **WHEN** candidate path provenance is persisted or returned to a student consumer
- **THEN** it does not expose database IDs, LearningFact IDs, source log IDs, source event IDs, raw answers, private conversations, reason codes, fingerprints, raw evidence JSON, or model prompts

### Requirement: Adopted node selection basis preserves event references
When a candidate path is adopted, the system SHALL project the candidate's student-safe event references onto each affected node's historical selection basis and SHALL retain them as execution state changes.

#### Scenario: Candidate with event references is adopted
- **WHEN** a student selects a candidate path whose recommendation provenance links events to specific nodes
- **THEN** each affected selected node stores those references in its historical selection basis

#### Scenario: Selected node later completes or becomes locked
- **WHEN** execution state changes after the path was adopted
- **THEN** the node retains the event references that explained its original selection

#### Scenario: Legacy path has no event references
- **WHEN** an adopted path predates event-reference support
- **THEN** the node explanation remains available through its existing aggregate or legacy fallback contract
- **AND** no event reference is inferred from the current learner portrait

### Requirement: Candidate adjustment is grounded in one persisted source candidate
The adaptive learning path planner SHALL derive an adjustment from one authorized persisted source candidate plus normalized request parameters and current governed learner facts, and SHALL NOT infer the source from display order, title, or generated conversation text.

#### Scenario: Source candidate and request are valid
- **WHEN** an adjustment request identifies an authorized persisted source candidate and provides supported structured or mapped intent parameters
- **THEN** the planner SHALL preserve mandatory prerequisites, readiness, teacher policy, privacy, terminal validation, evidence policy, and safety constraints
- **AND** it SHALL generate adjusted alternatives relative to that source candidate.

#### Scenario: Source facts are unavailable
- **WHEN** the source candidate cannot be resolved or its required governed facts are incomplete
- **THEN** the planner SHALL return an unavailable result
- **AND** it SHALL NOT reconstruct the source from client ordering or assistant prose.

### Requirement: Candidate adjustment requires a material path difference
The adaptive learning path planner SHALL distinguish adjusted candidates using governed node identities and ordering or supported path metrics, and SHALL NOT treat explanation text, display labels, or score-only changes as a new route.

#### Scenario: Adjustment changes governed path facts
- **WHEN** a feasible adjusted candidate changes a non-mandatory node, node order, resource composition, checkpoint structure, or supported path constraint relative to the source
- **THEN** the planner SHALL expose the changed facts for server-side difference validation.

#### Scenario: Constraints permit no material alternative
- **WHEN** higher-priority constraints and governed resources cannot produce a materially different executable candidate
- **THEN** the planner SHALL return a structured no-material-difference limitation
- **AND** it SHALL NOT fabricate a cosmetic alternative.

