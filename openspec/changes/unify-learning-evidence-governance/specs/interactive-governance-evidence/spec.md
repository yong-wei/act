## ADDED Requirements

### Requirement: Interactive evidence participates in unified governance
Interactive classroom and standalone interactive evidence SHALL be classified through the unified learning evidence catalog before profile, report, or recommendation consumers rely on it.

#### Scenario: Interactive evidence is cataloged
- **WHEN** interactive classroom or standalone interactive events are inspected for governance
- **THEN** the system SHALL classify each event family by source table, canonical event type, evidence value level, profile eligibility, and traceability fields
- **AND** the classification SHALL preserve the existing durable submission and report requirements for `StudentStepResponse`, `InteractionLog`, and `LearningFact`.

#### Scenario: Interactive evidence uses canonical event type
- **WHEN** interactive event rows use legacy wrapper types such as `view`, `interact`, `submit`, or `complete`
- **THEN** governance consumers SHALL resolve the canonical type from the payload when present
- **AND** classroom and standalone evidence SHALL not be undercounted because only the wrapper type was inspected.

#### Scenario: Interactive profile contribution follows value policy
- **WHEN** interactive evidence is used for student profile or recommendation features
- **THEN** high-value submissions and completions SHALL be eligible for competency contribution
- **AND** low-value views or navigation SHALL remain activity context unless an explicit contribution rule exists.
