## MODIFIED Requirements

### Requirement: Control-correction planner returns three path styles
The path planner SHALL provide a directly comparable three-style path bundle for control-correction diagnosis when sufficient resources and evidence exist. The number of serialized candidate options SHALL equal the goal's target option count (three) whenever a policy-family request is present, including starter injection and low-confidence fallback paths; the primary planning family SHALL NOT be appended as an additional candidate beyond the requested families.

#### Scenario: Three-style bundle is generated
- **WHEN** a student opens the control-correction path center from diagnosis or adaptive practice
- **THEN** the system SHALL display available path styles with style id, policy family, target deficits, estimated effort, resource mix, terminal validation strategy, evidence basis, and limitations
- **AND** the serialized option count SHALL equal three (`optionCount === 3`)
- **AND** unavailable or insufficient path diversity SHALL be represented as fallback state rather than three cosmetic cards.

#### Scenario: Starter injection keeps the option count fixed
- **WHEN** the planner auto-injects starter policy families because the learner state is missing, confidence is low, or evidence count is at most one
- **THEN** the candidate bundle SHALL contain exactly the requested starter families and the target option count (three) SHALL NOT be exceeded
- **AND** the primary `rules-plus-graph-search` route SHALL NOT be appended as an extra candidate option.

#### Scenario: Resources are insufficient
- **WHEN** the planner cannot produce meaningfully distinct path options
- **THEN** it SHALL return an explicit low-resource or low-confidence fallback
- **AND** it SHALL NOT show three cosmetic variants with materially identical resources
- **AND** it SHALL NOT compensate for unavailable diversity by adding a fourth route beyond the requested families.
