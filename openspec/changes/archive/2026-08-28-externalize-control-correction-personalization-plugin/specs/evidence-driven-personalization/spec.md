## ADDED Requirements

### Requirement: Personalization rationale uses plugin-declared governed sources

Evidence-driven profile and recommendation projections for a registered goal SHALL use the plugin-declared Learning Record/Assessment source mappings, confidence policy and privacy scope. Course IDs, lesson IDs and Arena task IDs alone MUST NOT be treated as evidence.

#### Scenario: Control-correction recommendation is generated

- **WHEN** a recommendation uses control-correction evidence
- **THEN** its rationale SHALL identify the plugin version, governed source category, evidence window, confidence and privacy-safe refs
- **AND** it SHALL preserve missing/stale/preview limitations.

#### Scenario: Raw course payload is supplied

- **WHEN** a client or route supplies raw course/lesson/task payload without a governed source ref
- **THEN** Personalization SHALL reject it as authoritative evidence
- **AND** it SHALL not create a high-confidence profile claim or recommendation.
