## ADDED Requirements

### Requirement: Personalization consumes knowledge capability evidence writeback
Profile, diagnosis, and recommendation personalization SHALL consume knowledge/capability evidence only after it has been materialized from governed sources.

#### Scenario: Evidence updates capability state
- **WHEN** path execution, exercise, teacher-approved grading, simulation, Arena, interactive lesson, or approved Konling tool outcome is materialized
- **THEN** the evidence SHALL identify knowledge node, capability target where available, source type, evidence window, confidence, source coverage, freshness, and privacy-safe references
- **AND** personalization MAY use it as rationale according to its confidence and scope.

#### Scenario: Raw assistant narrative exists
- **WHEN** raw Konling dialogue or unreviewed model narrative mentions learner mastery
- **THEN** personalization SHALL NOT treat it as high-confidence mastery evidence
- **AND** it MAY only use a governed AgentToolRun, approved intervention outcome, materialized evidence summary, or verified citation summary.

#### Scenario: Evidence is context-only
- **WHEN** navigation, passive views, generic chat, or uncompleted resource access is observed
- **THEN** personalization SHALL identify it as context or low-confidence evidence
- **AND** it SHALL NOT use it as the sole basis for a high-confidence mastery claim.
