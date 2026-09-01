## ADDED Requirements

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
