## ADDED Requirements

### Requirement: Recommendation and intervention evidence uses one governed policy boundary

Evidence-driven personalization SHALL obtain recommendation and intervention inputs from Personalization policy over Learning Record facts and authorized Assessment/Arena/simulation read ports. It SHALL preserve the same rationale, provenance, confidence, privacy and owner-scope rules for every caller.

#### Scenario: Policy combines facts from multiple domains

- **WHEN** a decision combines LearningFact, assessment result and path/plugin context
- **THEN** the policy SHALL retain source provenance and privacy class for each governed input
- **AND** it SHALL not expose raw source payloads or turn a policy narrative into a high-confidence fact.

#### Scenario: A non-learning interaction is observed

- **WHEN** the input is ordinary browsing, a prompt, a hint request or an unverified recommendation click
- **THEN** the system MAY use it as limited context under the evidence policy
- **AND** it SHALL not treat it as independent mastery evidence.

### Requirement: Cross-process evidence has an auditable single materialization

Evidence-driven personalization SHALL use the existing `EvidenceOutbox → worker → LearningFact` contract for asynchronous intervention projection. The producer port SHALL atomically stage one deduplicated, privacy-safe outbox receipt with stable action/causation identity; only the worker MAY materialize the corresponding LearningFact, and missing or unapplied outbox state MUST remain explicit.

#### Scenario: A worker replays an applied receipt

- **WHEN** a crash, retry or duplicate delivery replays an outbox receipt already marked applied
- **THEN** the worker SHALL return the existing materialization using its persisted dedupe/causation constraint
- **AND** it SHALL not append another Fact or count the intervention twice.

#### Scenario: Producer and outbox both attempt a Fact write

- **WHEN** a path attempts a direct LearningFact write and an EvidenceOutbox write for the same asynchronous intervention
- **THEN** the contract SHALL reject the double-write or make one side a no-op before materialization
- **AND** the public evidence projection SHALL not expose a duplicate contribution.
