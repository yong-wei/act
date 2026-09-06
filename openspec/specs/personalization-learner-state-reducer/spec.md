# personalization-learner-state-reducer Specification

## Purpose
Define the Personalization-owned pure learner-state reducer, owned Learning Record and Assessment read ports, and single public API that replaces the old data-governance service authority.
## Requirements
### Requirement: Learner state is computed by a pure reducer

Personalization SHALL expose a deterministic `LearnerStateReducer` that accepts normalized Learning Record and Assessment read-port inputs, goal/plugin context, role scope, algorithm version and evaluation time. The reducer MUST NOT read Prisma, Next, React, raw client hints, queues, or write persistent state.

#### Scenario: Same governed input is reduced twice

- **WHEN** the reducer receives the same facts, assessment outcomes, policy versions and evaluation time
- **THEN** it SHALL return the same learner-state values, confidence, freshness and limitation metadata
- **AND** it SHALL not issue I/O or mutate the input.

#### Scenario: Evidence is missing or stale

- **WHEN** read-port input lacks a required source, is stale, partial or low confidence
- **THEN** the reducer SHALL return an explicit limitation/no-evidence state
- **AND** it SHALL not synthesize high-confidence mastery or a complete diagnosis.

### Requirement: Learner-state inputs come through owned read ports

The application layer SHALL obtain learner facts and snapshots through the Learning Record read port and assessment outcomes/mastery through the Assessment read port. Personalization MUST NOT query raw Prisma tables or reconstruct authoritative facts from route payloads, profile summaries or model narratives.

#### Scenario: Personalization reads assessment evidence

- **WHEN** learner state needs assessment-backed mastery or an ability estimate
- **THEN** the application SHALL request the durable Assessment read projection
- **AND** the reducer SHALL retain its source, algorithm version, confidence and immutable reference.

#### Scenario: A client supplies profile values

- **WHEN** a client sends a learner-state or profile hint
- **THEN** the application SHALL treat it as non-authoritative context
- **AND** the reducer SHALL not use it to replace Learning Record or Assessment evidence.

### Requirement: One public boundary serves role and goal projections

Personalization SHALL provide one server-owned learner-state public API that projects student, teacher, admin and system views from the reducer result. Alternate convenience functions MAY map the public DTO but MUST NOT implement a second reducer or bypass role, privacy and confidence policies.

#### Scenario: Authorized consumer requests a goal projection

- **WHEN** a student, teacher, admin or service requests a registered goal projection
- **THEN** the public API SHALL authorize the subject and role scope before reading ports
- **AND** it SHALL return only fields declared by the goal and privacy contracts with confidence/source metadata.

#### Scenario: Goal has no registered plugin context

- **WHEN** a requested goal is not registered or its plugin context is unavailable
- **THEN** the public API SHALL return an explicit unsupported/limited state
- **AND** it SHALL not fall back to course-specific constants or a second goal implementation.

### Requirement: Reducer preserves evidence authority and privacy invariants

The reducer and projector SHALL preserve portrait v2, assessment-backed mastery confidence, LearningFact identity/revision, evidence freshness, no-data/unavailable distinction and canonical privacy scopes. Browsing, passive views, prompts and unverified intervention narratives MUST NOT grant high-confidence mastery.

#### Scenario: Non-assessment activity is present

- **WHEN** browsing, navigation, passive media views or unverified assistance appears in the Learning Record input
- **THEN** it MAY contribute context or a remediation signal according to policy
- **AND** it SHALL not by itself create high-confidence mastery or unlock a hard path gate.

#### Scenario: Student-facing projection is returned

- **WHEN** a student-facing learner state is projected
- **THEN** it SHALL expose only student-visible summaries, confidence, freshness and safe source references
- **AND** teacher-scoped, audit-only, system-internal and raw answer payloads SHALL remain restricted.

### Requirement: Legacy learner-state authority is removed after migration

When all declared callers have migrated, the old `adaptive-learner-state-service` public authority, forwarding export and duplicate read path SHALL be deleted. The migration MUST leave no production import of the old authority while preserving old data tables and read adapters still owned by other domains.

#### Scenario: Caller migration is complete

- **WHEN** route, worker, profile, Konling, graph, recommendation and feature-cache callers use the new public API and their tests pass
- **THEN** the old service public entry SHALL be removed
- **AND** architecture evidence SHALL prove zero production imports or re-exports remain.

#### Scenario: A caller is not migrated

- **WHEN** a production caller still depends on the old learner-state authority
- **THEN** the change SHALL fail its deletion gate
- **AND** it SHALL not add a forwarding facade or silently delete the old path.

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

### Requirement: Personalization owns evidence adaptation for learner state and path decisions
Personalization SHALL own the adapter that combines Learning Record and Assessment read-port evidence with registered goal/plugin context for learner-state, path, recommendation and intervention decisions. Generic Learning Record code MUST remain course-agnostic and MUST NOT contain Personalization business policy.

#### Scenario: Learner state requests assessment evidence
- **WHEN** Personalization evaluates a learner state or path decision
- **THEN** its application layer SHALL read the durable Assessment projection and Learning Record current projection through declared ports
- **AND** the reducer SHALL retain source refs, revisions, confidence, freshness and limitation state

#### Scenario: Evidence is unavailable
- **WHEN** a required source is missing, stale, partial, preview-only or low confidence
- **THEN** Personalization SHALL return an explicit limited/no-evidence result
- **AND** it SHALL not synthesize mastery, readiness or a complete diagnosis

### Requirement: Personalization adapter migration removes data-governance business authority
After all callers move, old learner-state/path/recommendation/intervention adapters in `data-governance` SHALL have zero production imports or re-exports. Historical or audit readers MAY remain only as explicitly authorized non-online adapters.

#### Scenario: All callers use domain owners
- **WHEN** route, worker, script and report import scans plus parity tests show no required old caller
- **THEN** the migration SHALL delete the old business adapter and record the replacement owner and revision evidence
- **AND** it SHALL preserve existing LearningFact, snapshot and path history

#### Scenario: An unresolved old caller exists
- **WHEN** any production caller still reaches the old adapter
- **THEN** the deletion gate SHALL fail closed
- **AND** no forwarding facade or second Personalization authority SHALL be added

### Requirement: Learner-state second pass reduces the mixed internal implementation
The second simplification pass SHALL make the existing pure reducer and effectful application boundary visible in module dependencies. Against commit `f79f1836fd57dce483d01194e627ef36d929d637`, the fixed baseline is all seven non-test `.ts`/`.tsx` files under `src/features/personalization/learner-state/`, totaling 127,848 bytes. Completion SHALL reduce that total to at most 125,671 bytes, counting any new production file or positive byte delta that receives code moved from the baseline set. The original 102,278-byte target was relaxed by the repository owner after a full-duplication audit proved it unreachable without violating the public-API and behavior invariants: every exported symbol and type has active consumers, no function-level semantic duplication remains, and the non-function bulk is the public API surface itself (see Issue #1969). It MUST NOT add a second reducer, forwarding facade, public export, or alternate evidence authority.

#### Scenario: Pure and effectful responsibilities are simplified
- **WHEN** the pass moves, inlines, or deletes a learner-state helper
- **THEN** reducer code SHALL remain deterministic and free of database, route, queue, cache-write, and persistence effects
- **AND** application/adapters SHALL retain authorization, reads, pagination, and persistence attachment.

#### Scenario: Behavior is compared with the baseline
- **WHEN** the simplified module is evaluated with the characterized Learning Record, Assessment, portrait, plugin, role, freshness, and no-evidence inputs
- **THEN** values, limitations, source identities, visibility, and ordering SHALL remain equivalent
- **AND** before/after evidence SHALL show the required byte reduction using the fixed calculation.

#### Scenario: A change only redistributes code
- **WHEN** the calculated after total exceeds 125,671 bytes or a new facade or duplicate reducer appears
- **THEN** the pass SHALL not be accepted
- **AND** the last passing implementation SHALL remain the rollback point.

