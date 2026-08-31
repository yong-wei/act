## ADDED Requirements

### Requirement: Personalization is the strategy authority

Personalization SHALL expose one governed recommendation use case and one governed intervention-decision use case. Recommendation, intervention, remediation and worker callers MUST use these public contracts and MUST NOT implement a second strategy in Learning Record, route handlers, feature components or data-governance repositories.

#### Scenario: Student recommendations are requested

- **WHEN** an authenticated student requests recommendations
- **THEN** Personalization SHALL evaluate governed learner facts, assessment/path/plugin context and privacy scope
- **AND** it SHALL return soft recommendations with rationale, provenance, confidence and policy revision without creating mastery or eligibility.

#### Scenario: A worker retries a decision

- **WHEN** a worker retries the same recommendation or intervention decision
- **THEN** the public use case SHALL return the existing decision for the stable identity
- **AND** it SHALL not append a duplicate decision, fact or outcome.

### Requirement: Learning Record is fact storage, not policy

Personalization MUST consume and record facts through Learning Record ports. Learning Record SHALL retain authority over LearningFact validation, snapshot/watermark, privacy projection and deduplication, but SHALL NOT rank recommendations, choose interventions or infer mastery from policy output.

#### Scenario: A policy needs learner evidence

- **WHEN** a recommendation or intervention policy evaluates learner evidence
- **THEN** it SHALL receive governed read-port data with provenance and privacy metadata
- **AND** it SHALL not query raw event payloads, raw answers or Prisma directly.

### Requirement: Cross-process intervention projection uses one transactional EvidenceOutbox

For a micro-intervention whose governed evidence must cross a process boundary, the Personalization/Learning Record port SHALL stage exactly one existing `EvidenceOutbox` row in the intervention decision transaction. The row MUST carry stable `actionId`, `causationId`, dedupe identity, subject scope, source revision and a privacy-safe projection. The worker SHALL be the only LearningFact materializer for this path; a producer MUST NOT write the same Fact directly alongside the outbox.

#### Scenario: An intervention decision needs asynchronous projection

- **WHEN** a decision requires a worker to project an allowed outcome into LearningFact
- **THEN** the decision transaction SHALL atomically persist the decision and one uniquely deduplicated outbox row
- **AND** the public result SHALL identify the staged/pending state rather than claim that the learner profile is already refreshed.

#### Scenario: The worker crashes or receives a duplicate

- **WHEN** the worker crashes after staging or receives the same outbox delivery again
- **THEN** it SHALL use the persisted action/causation/dedupe identity and auditable `staged`/`deduplicated`/`applied` (or equivalent) state to replay safely
- **AND** at most one canonical LearningFact SHALL be materialized.

#### Scenario: An outbox row is missing

- **WHEN** a cross-process decision has no corresponding EvidenceOutbox row
- **THEN** the system SHALL report pending/unavailable or fail closed
- **AND** it SHALL not claim that the learner profile or evidence snapshot was refreshed.

#### Scenario: Assessment fact write is synchronous

- **WHEN** Assessment completes official scoring and writes its canonical fact in the same transaction without a process boundary
- **THEN** it MAY continue using the direct Assessment fact-write contract
- **AND** this change SHALL not force eventization or alter Arena's official evaluator authority.

#### Scenario: A privacy-restricted source reaches the outbox

- **WHEN** an answer, prompt, model response or user identifier is available to the producer
- **THEN** the outbox receipt and public LearningFact projection SHALL exclude the raw value
- **AND** only the governed privacy-safe projection and source references SHALL cross the boundary.

### Requirement: Recommendations remain soft

A recommendation, explanation, ordinary browsing event, prompt, hint request or model narrative MUST NOT by itself grant mastery, readiness, prerequisite satisfaction, path eligibility or permission. Independent Assessment, Arena or simulation validation remains the authority for any contribution.

#### Scenario: A learner opens a recommended resource

- **WHEN** the learner browses or opens a recommended resource without an independently validated contribution
- **THEN** the system MAY record a governed usage event
- **AND** it SHALL not promote mastery or hard eligibility from that event alone.

### Requirement: Intervention events are bounded and idempotent

Intervention lifecycle events SHALL use only `RESOURCE_USED`, `HINT_REQUESTED` and `COMPLETED`, with server-derived owner, decision, intervention and revision identity. Events MUST be idempotent and MUST preserve the distinction between policy outcome and independently verified learning evidence.

#### Scenario: A completion is reported twice

- **WHEN** the same intervention completion is delivered twice
- **THEN** the system SHALL retain one canonical event/outcome
- **AND** a duplicate SHALL not produce another mastery update or LearningFact.

#### Scenario: Completion lacks independent validation

- **WHEN** an intervention completes without a verified Assessment, Arena or simulation contribution
- **THEN** the system SHALL record at most the bounded intervention outcome
- **AND** it SHALL not emit an assessment-backed mastery fact.

### Requirement: Privacy and role scope are enforced at the policy boundary

Recommendation and intervention decisions MUST be scoped to the authenticated learner/owner and declared privacy class. Teacher, admin and student projections SHALL not cross the existing role boundary or expose raw answers, event payloads, identifiers or model-generated private text.

#### Scenario: A caller requests another learner's decision

- **WHEN** a caller supplies a different learner identity or an unauthorized role projection
- **THEN** the use case SHALL fail closed before reading or writing policy state
- **AND** it SHALL not disclose whether a private decision exists.
