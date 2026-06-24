## MODIFIED Requirements

### Requirement: Personalization consumes knowledge capability evidence writeback
Profile, diagnosis, path planning, and recommendation personalization SHALL consume knowledge, capability, and quality evidence only after it has been materialized from governed sources.

#### Scenario: Evidence updates graph overlay state
- **WHEN** path execution, exercise, teacher-approved grading, simulation, Arena, interactive lesson, or approved Konling tool outcome is materialized through K/A/Q evidence writeback
- **THEN** personalization MAY use it as rationale according to its target refs, confidence, authority, freshness, source coverage, privacy-safe references, and limitation metadata
- **AND** raw source payloads or unreviewed model narrative SHALL NOT bypass the writeback governance layer.

#### Scenario: Writeback is degraded
- **WHEN** evidence is missing required graph/resource/version/citation context or is preview-only
- **THEN** personalization SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation, profile claim, or diagnosis as a complete precise mastery judgment.
