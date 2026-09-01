## ADDED Requirements

### Requirement: Normal consumers do not rebuild Learning Record projections
Normal page, route, AI and Personalization code SHALL use the stable role-appropriate Learning Record read ports. It MUST NOT aggregate raw LearningFacts/events or invoke historical backfill/materialization code to repair a missing current projection during an online request.

#### Scenario: Page requests stale evidence
- **WHEN** a normal page receives a stale or unavailable read-port result
- **THEN** it SHALL expose the governed status, coverage and freshness limitation
- **AND** it SHALL not silently calculate a replacement from raw facts

#### Scenario: Historical operation needs raw evidence
- **WHEN** an authorized audit, debug or backfill operation needs historical raw access
- **THEN** it SHALL use its explicit operation boundary, purpose and revision-bound receipt
- **AND** that permission SHALL not be inherited by normal consumers

### Requirement: Consumer simplification preserves role and small-sample semantics
Removing duplicate consumer aggregation or fallback SHALL preserve server-derived scope, role-minimum payloads, known-zero versus unavailable, independent-learner suppression, provenance and privacy restrictions.

#### Scenario: Teacher cohort is below the threshold
- **WHEN** an authorized teacher reads a small class aggregate
- **THEN** the simplified consumer SHALL suppress sensitive values while returning truthful status and coverage
- **AND** it SHALL not replace missing values with zero or raw rows

#### Scenario: Student requests another subject
- **WHEN** a student or client hint targets another learner, class or tenant
- **THEN** the read port SHALL reject before projection access
- **AND** simplification SHALL not broaden server-derived scope
