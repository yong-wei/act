## ADDED Requirements

### Requirement: Portrait update regressions are gated
The data-quality gates SHALL detect portrait update behavior that can erase
stable learner scores without negative evidence.

#### Scenario: Sparse update regression is tested
- **WHEN** the portrait update regression suite runs
- **AND** an existing learner portrait receives sparse evidence for only one dimension
- **THEN** untouched dimensions SHALL retain their prior score
- **AND** the gate SHALL fail if those dimensions become zero or missing.

#### Scenario: Evidence aging is tested
- **WHEN** evidence ages beyond the recent activity window
- **THEN** score SHALL remain available as long-term portrait state
- **AND** the gate SHALL verify that freshness or confidence carries the aging signal.
