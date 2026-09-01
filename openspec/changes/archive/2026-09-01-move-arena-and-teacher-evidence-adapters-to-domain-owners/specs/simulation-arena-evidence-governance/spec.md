## ADDED Requirements

### Requirement: Arena owns official and preview evidence adapters
Arena SHALL own the mapping from persisted submissions, evaluations and preview SimulationRun envelopes to normalized evidence. The adapter SHALL preserve official/preview status, task identity, evaluation policy, replay confidence and source anchors while using the existing Learning Record writer; generic `data-governance` code MUST NOT redefine official Arena meaning.

#### Scenario: Official submission is written back
- **WHEN** a persisted, accepted Arena submission completes its official evaluation
- **THEN** the Arena owner SHALL emit one compact, revision-bound evidence/write request with official validity and constraint outcomes
- **AND** it SHALL retain the submission as the authority for score, rank and task completion

#### Scenario: Preview result is materialized
- **WHEN** a preview SimulationRun or ordinary workbench run is converted to governed evidence
- **THEN** the Arena adapter SHALL mark it preview-only and officially ineligible
- **AND** it SHALL not create official score, leaderboard, hard-constraint or task-completion authority

#### Scenario: Submission scope is invalid
- **WHEN** an evaluation is not uniquely bound to the authenticated student's accepted submission or carries a mismatched task/revision
- **THEN** the Arena adapter SHALL reject or mark it unbound
- **AND** it SHALL not fall back to client, preview or raw event values

### Requirement: Arena adapter migration preserves evidence idempotency and privacy
Moving Arena evidence adapters SHALL preserve stable product identity, dedupe, outbox/transaction semantics, hidden-scenario redaction, compact summaries and user/class scope. Raw traces, model narrative and direct identifiers MUST remain outside ordinary LearningFact and consumer payloads.

#### Scenario: Official writeback is retried
- **WHEN** the same submission/evaluation and dedupe identity is processed again or a worker restarts
- **THEN** the owner SHALL return the existing write/result or deterministic duplicate outcome
- **AND** it SHALL not double-count LearningFact or alter the official result
