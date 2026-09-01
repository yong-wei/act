## ADDED Requirements

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
