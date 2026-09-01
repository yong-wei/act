## ADDED Requirements

### Requirement: Learner-state simplification follows the canonical pure boundary

The Personalization learner-state implementation SHALL establish the canonical reducer owner, read-port/application boundary, production consumers, deletion set, and non-deletable invariants before invoking `code-simplification` on learner-state code.

#### Scenario: Owner and characterization are qualified

- **WHEN** C0–C2 evidence identifies Personalization as the owner and existing tests cover reducer, role, goal, source, error, and no-data behavior
- **THEN** the implementation MAY invoke `code-simplification` for one bounded learner-state slice
- **AND** the skill input SHALL include behavior invariants, trust boundaries, target files, allowed deletions, baseline metrics, and explicit non-goals.

#### Scenario: Pure-boundary evidence is incomplete

- **WHEN** a target helper still has unresolved ownership, an unclassified production caller, direct persistence effects, or an uncovered privacy/error path
- **THEN** simplification SHALL stop before deleting or merging it
- **AND** the missing evidence SHALL be recorded for design review.

### Requirement: Pure reduction and effectful assembly remain separate

The simplified implementation SHALL keep the learner-state reducer deterministic and I/O-free over normalized Learning Record, Assessment, plugin, role, policy, and evaluation-time inputs; database/cache reads, authorization, pagination, and persistence attachment SHALL remain in application or adapter boundaries.

#### Scenario: Same normalized input is reduced twice

- **WHEN** the reducer receives the same normalized facts, assessment outcomes, policy, role scope, and evaluation time
- **THEN** it SHALL return behavior-equivalent values, confidence, freshness, limitations, and source metadata without I/O or input mutation
- **AND** the result SHALL not depend on process-local fallback state.

#### Scenario: Application assembles reducer inputs

- **WHEN** a learner-state request reads Learning Record, Assessment, feature-cache, portrait, path, or plugin data
- **THEN** the application/adapters SHALL perform those reads and normalize each governed fact once before reduction
- **AND** the reducer SHALL not query Prisma, Next, React, routes, queues, or raw client hints.

### Requirement: Learner-state behavior and authority protections survive simplification

Simplification SHALL preserve portrait-v2 primary evidence, assessment-backed mastery confidence, role/privacy scopes, LearningFact identity and revision, freshness, no-evidence versus unavailable distinction, plugin goal-slice limits, path context, and explicit legacy compatibility boundaries.

#### Scenario: Current portrait is `NO_EVIDENCE`

- **WHEN** the authorized cumulative portrait has no trusted eligible evidence
- **THEN** the learner-state result SHALL remain `NO_EVIDENCE` with its limitation/source metadata
- **AND** it SHALL not substitute a legacy snapshot, feature cache, competency vector, or model narrative as primary personalization input.

#### Scenario: Student projection is returned

- **WHEN** a student-facing projection is generated
- **THEN** it SHALL include only student-safe fields, confidence/freshness, and allowed source references
- **AND** teacher, audit, system-internal, raw-answer, and private payloads SHALL remain restricted.

#### Scenario: Goal plugin is missing

- **WHEN** a requested goal has no registered current plugin context
- **THEN** the result SHALL expose an explicit unsupported/limited state
- **AND** it SHALL not fall back to course constants or a second goal implementation.

### Requirement: Learner-state simplification produces a net production reduction

The completed change SHALL demonstrate a net reduction in learner-state production bytes and semantic complexity; extracting equal or greater code into more files SHALL not qualify.

#### Scenario: Before and after metrics are compared

- **WHEN** the stable simplified revision is measured against the current-head baseline
- **THEN** evidence SHALL report production bytes/LOC, public exports, functions, state variants, guards, validators, duplicate fact conversions, dependencies, and tests
- **AND** production bytes and the agreed semantic concept inventory SHALL both be lower, with any target threshold and limitations stated.

#### Scenario: Reduction is only cosmetic

- **WHEN** bytes or semantic concepts remain equal/increase, a new forwarding reducer appears, or duplicate state/validator authority remains
- **THEN** the change SHALL not claim completion
- **AND** it SHALL stop for redesign or rollback.

### Requirement: Learner-state simplification is progressively verified and reversible

Each bounded pass SHALL run direct reducer/application characterization and related route/contract tests, followed by typecheck, lint, architecture fitness, and staged Ponytail review; the last passing implementation and measurements SHALL remain a rollback checkpoint.

#### Scenario: A pass changes a protected behavior

- **WHEN** a test detects changed output, error, role visibility, source identity, freshness, no-data, ordering, or side effects
- **THEN** the pass SHALL be reverted or repaired before another pass
- **AND** the prior passing revision SHALL remain available for rollback.

#### Scenario: Final simplification is accepted

- **WHEN** all behavior, authority, architecture, review, and net-reduction evidence passes
- **THEN** the change MAY be archived with its before/after report
- **AND** it SHALL not imply schema migration, data rewrite, deployment, or production activation.
