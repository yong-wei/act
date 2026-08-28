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

