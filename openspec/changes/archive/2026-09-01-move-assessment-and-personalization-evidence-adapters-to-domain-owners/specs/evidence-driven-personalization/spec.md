## ADDED Requirements

### Requirement: Personalization evidence adapters use governed ports and one writer boundary
Evidence-driven recommendations and interventions SHALL receive normalized, revision-bound inputs through Personalization-owned adapters and declared Learning Record/Assessment ports. They MUST NOT query raw facts, route payloads or `data-governance` business internals, and MUST NOT write a parallel evidence store.

#### Scenario: Recommendation consumes domain-owned evidence
- **WHEN** a recommendation or intervention is evaluated
- **THEN** Personalization SHALL use the registered goal/plugin policy and governed source refs
- **AND** the result SHALL preserve confidence, coverage, freshness, provenance and idempotency metadata

#### Scenario: Recommendation input is client-authored
- **WHEN** a client supplies profile values, mastery, path or evidence hints
- **THEN** the adapter SHALL treat them as non-authoritative context
- **AND** it SHALL not use them to replace Assessment or Learning Record evidence

### Requirement: Adapter migration preserves recommendation and intervention authority
Moving the evidence adapter SHALL not change hard eligibility, Assessment mastery, Learning Record fact identity, official Arena authority, teacher scope or the advisory-only nature of recommendation/intervention output.

#### Scenario: Adapter returns a low-confidence result
- **WHEN** source coverage is partial, stale, provisional or unavailable
- **THEN** Personalization SHALL expose the limitation and bounded advisory result
- **AND** it SHALL not promote the result into high-confidence mastery or a hard path gate

#### Scenario: Adapter is retried
- **WHEN** the same subject, evidence revision and idempotency identity is processed again
- **THEN** the owner boundary SHALL return the existing decision/materialization result
- **AND** it SHALL not duplicate LearningFacts, mastery updates, path events or intervention records
