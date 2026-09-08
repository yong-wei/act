# personalization-path-planning-pipeline Specification

## Purpose
Defines the unique Personalization `PlanLearningPath` application pipeline: goal context, candidate discovery, hard eligibility, soft ranking, constraint repair, path assembly and explanation, with course policy supplied only by registered plugins.
## Requirements
### Requirement: Personalization exposes one PlanLearningPath use case

Personalization SHALL expose `PlanLearningPath` as the only application use case that assembles a learner path. Learning-path routes, advisor APIs, candidate-batch APIs, Konling and path execution callers MUST use this contract and the canonical path output; they MUST NOT import a planner implementation or assemble a competing path.

#### Scenario: A learner requests a path

- **WHEN** an authenticated learner requests a path for an authorized goal and current path revision
- **THEN** the application SHALL load the governed learner/goal context and execute the canonical pipeline
- **AND** it SHALL return a path with the existing revision, provenance and terminal-validation semantics.

#### Scenario: A caller requests candidates only

- **WHEN** an advisor or candidate-batch caller needs candidates without a final path
- **THEN** it SHALL use the same application context and candidate/eligibility ports
- **AND** it SHALL not create a second ranking or assembly authority.

### Requirement: Planning stages preserve hard and soft boundaries

The use case SHALL execute `GoalContextLoader`, `CandidateProvider`, `EligibilityPolicy`, `RankingStrategy`, `ConstraintRepair`, `PathAssembler` and `ExplanationBuilder` as distinct responsibilities. Hard eligibility SHALL be decided before soft ranking; recommendation, explanation or ordinary browsing MUST NOT grant hard eligibility, mastery or completion.

#### Scenario: A preferred resource is not eligible

- **WHEN** a soft ranking strategy prefers a candidate that fails a prerequisite, permission or resource-state rule
- **THEN** the candidate SHALL remain excluded by `EligibilityPolicy`
- **AND** ranking and explanation SHALL not reintroduce it as an executable path node.

#### Scenario: Repair encounters an invalid dependency

- **WHEN** deterministic constraint repair cannot satisfy a dependency or terminal constraint
- **THEN** the use case SHALL return a bounded unsupported/limited result with its reason
- **AND** it SHALL not silently append an unqualified node.

### Requirement: Course-specific planning is supplied by registered plugins

Generic Personalization planning MUST consume course and Arena policy through the registered plugin and governed read ports. The generic pipeline MUST NOT contain concrete course, lesson or Arena task identifiers, and it MUST NOT use reinforcement learning or a second course strategy registry.

#### Scenario: Control-correction planning is requested

- **WHEN** the goal resolves to the control-correction plugin
- **THEN** candidate discovery, evidence requirements and terminal policy SHALL come from that plugin
- **AND** the generic planner SHALL remain unaware of the plugin's concrete identifiers.

#### Scenario: A plugin is missing or retired

- **WHEN** no current plugin can satisfy the requested goal policy
- **THEN** planning SHALL fail closed or return an explicit limited result
- **AND** it SHALL not fall back to hardcoded course behavior.

### Requirement: Path history and evidence remain durable and append-only

Planning SHALL preserve existing immutable path revision, candidate provenance, correction evidence, stale-input and concurrency semantics. A new plan or repair MUST append an authorized history entry rather than mutate prior path nodes or erase evidence.

#### Scenario: A stale plan is submitted

- **WHEN** a caller attempts to adopt or execute a plan against an older path revision
- **THEN** the application SHALL reject it with the canonical conflict/stale result
- **AND** it SHALL not overwrite the current path history.

### Requirement: Canonical path assembly is simplified only after owner and behavior are understood

The Personalization path-planning implementation SHALL run characterization coverage and establish its canonical owner, production consumers, deletion boundary, and non-deletable invariants before invoking `code-simplification` on the path assembly implementation.

#### Scenario: Canonical owner and characterization are ready

- **WHEN** C0–C2 owner/consumer evidence is qualified and representative path behavior is covered by unchanged characterization tests
- **THEN** the implementation MAY invoke `code-simplification` for a bounded path-assembly slice
- **AND** the skill input SHALL state target files, behavior invariants, trust boundaries, allowed deletions, baseline metrics, and out-of-scope paths.

#### Scenario: Owner or behavior evidence is incomplete

- **WHEN** a target file still has unresolved competing ownership, an unclassified production consumer, or an uncovered error/side-effect path
- **THEN** the simplification SHALL stop before deleting or merging code
- **AND** it SHALL record the missing evidence rather than optimizing a potentially retired authority.

### Requirement: Path assembly preserves the canonical pipeline and protected behavior

Simplification SHALL preserve the single `PlanLearningPath` use case, hard-eligibility-before-ranking order, deterministic constraint repair, registered plugin policy, path revision/provenance, fallback/error semantics, terminal-validation requirements, privacy projections, and append-only execution/feedback behavior.

#### Scenario: Existing path inputs are replayed

- **WHEN** the same governed goal, learner state, registry, constraints, plugin context, time, and version inputs are passed before and after simplification
- **THEN** the selected/blocked nodes, order, status, fallback reasons, policy bundle, evidence/provenance, and serialized student-safe output SHALL remain behavior-equivalent
- **AND** no second planner or hidden persistence/write path SHALL be introduced.

#### Scenario: A candidate fails hard eligibility

- **WHEN** a resource fails prerequisite, permission, readiness, privacy, terminal, or other hard eligibility policy
- **THEN** it SHALL remain excluded before ranking and repair
- **AND** explanation/ranking simplification SHALL not reintroduce it as an executable node.

### Requirement: Simplification produces a net production reduction

The completed change SHALL demonstrate a net reduction in the path-planning production module's bytes and semantic complexity; moving equal or greater code into multiple files SHALL not qualify as simplification.

#### Scenario: Before and after metrics are compared

- **WHEN** the stable simplified revision is measured against the current-head baseline
- **THEN** the evidence SHALL report production bytes/LOC, public exports, functions, state variants, guards, validators, duplicate conversions, dependencies, and tests
- **AND** production bytes and the agreed semantic concept inventory SHALL both be lower, with the plan's recommended target of at least 25% byte reduction recorded where achieved.

#### Scenario: Metrics do not show a net reduction

- **WHEN** production bytes or semantic concepts remain equal or increase, or a second authority/wrapper is added
- **THEN** the change SHALL not claim completion
- **AND** it SHALL stop for design review or rollback rather than count file splitting as progress.

### Requirement: Simplification verification is progressive and reversible

The implementation SHALL verify each bounded simplification with direct characterization tests, related path tests, typecheck, lint, architecture fitness, and staged Ponytail review, and SHALL preserve a rollback revision for the last passing state.

#### Scenario: A simplification pass changes behavior

- **WHEN** a direct or related test detects changed output, error, ordering, side effect, privacy, or revision semantics
- **THEN** that pass SHALL be reverted or repaired before the next pass
- **AND** the prior passing metrics and implementation SHALL remain the rollback checkpoint.

#### Scenario: Final path simplification is accepted

- **WHEN** behavior, invariant, architecture, review, and net-reduction evidence all pass
- **THEN** the change MAY be archived with its before/after report
- **AND** it SHALL not imply database, runtime, deployment, or production selector changes.

### Requirement: Path assembly pass 2 preserves behavior and reduces the implementation
The system SHALL simplify the existing canonical path assembly pipeline without adding another planner or changing its public contract. For the same inputs and stored state, the simplified pipeline MUST preserve path membership, order, eligibility, prerequisite repair, redaction, explanation, errors, and persistence effects. The completed change MUST reduce total path-planning production code or internal control-state complexity; moving the same logic between files is not sufficient.

#### Scenario: Existing path cases are replayed
- **WHEN** the current characterization cases run before and after the simplification
- **THEN** their returned paths, explanations, errors, ordering, and persistence effects are equivalent

#### Scenario: A proposed extraction only moves code
- **WHEN** a proposed change leaves total production logic and internal state complexity unchanged
- **THEN** the change is not accepted as completion of this requirement

### Requirement: Candidate discovery may consume the teaching-projection binding adapter
The `PlanLearningPath` pipeline MAY consume teaching-projection binding adaptations as one candidate source of its candidate-discovery port. The adapter SHALL feed the same candidate/eligibility ports as every other source and MUST NOT become a second ranking or assembly authority. `PlanLearningPath` SHALL remain the only use case that assembles a learner path; the adapter MUST NOT call or embed a competing planner such as `planActPrerequisitePath`.

#### Scenario: Binding adapter contributes candidates
- **WHEN** the pipeline runs for a goal whose resources carry teaching-projection bindings
- **THEN** candidate discovery SHALL include adapter-adapted candidates alongside the existing families
- **AND** hard eligibility SHALL still be decided by the eligibility stage before soft ranking

#### Scenario: Adapter output bypasses eligibility
- **WHEN** an adapter-adapted candidate fails a prerequisite, permission, readiness, or review rule
- **THEN** the eligibility stage SHALL exclude it
- **AND** no adapter signal SHALL reintroduce it as an executable path node

#### Scenario: A second assembly authority is proposed
- **WHEN** a change proposes wiring `planActPrerequisitePath` or any other planner into production path assembly
- **THEN** it SHALL be rejected under this capability
- **AND** prerequisite-projection candidate input MAY only enter as a future candidate-source port evaluated in its own change

