## MODIFIED Requirements

### Requirement: Current pointer publication is atomic and fenced
The system SHALL publish the immutable version and current pointer with an atomic transaction or equivalent durable compare-and-set receipt. A pointer MUST NOT move backward across generation, watermark, revision or cutover fence, and an ordinary backfill MUST NOT move the online current pointer; only the existing explicitly authorized migration/cutover contract may do so.

#### Scenario: Out-of-order candidate arrives
- **WHEN** an older or lower-generation candidate or an ordinary backfill result races with a newer current
- **THEN** the older result is retained only as history/conflict and current remains unchanged

#### Scenario: Concurrent publication
- **WHEN** two qualified candidates publish concurrently for one subject
- **THEN** exactly one fence-valid current pointer is visible and the losing result is auditable

#### Scenario: Authorized calculation version cutover
- **WHEN** a fence-valid candidate records a new `calculationVersion` together with a strictly newer generation or cutover fence and an explicit migration receipt
- **THEN** current advances to that candidate
- **AND** a same-fence version split or ordinary backfill result remains a conflict and does not overwrite current
