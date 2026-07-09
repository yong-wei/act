## ADDED Requirements

### Requirement: Portrait migration completeness is auditable
The data completeness helper SHALL report portrait v2 migration state for
learner data and diagnostic fixtures.

#### Scenario: Portrait migration audit runs
- **WHEN** the helper audits learner portrait readiness
- **THEN** it SHALL report native portrait v2 rows, migrated rows, stale rows, unmigrated legacy rows, and fixture blockers
- **AND** it SHALL use privacy-minimized learner identifiers.

#### Scenario: Fixture readiness is audited
- **WHEN** the helper audits the canonical Yang Fan account
- **THEN** it SHALL verify all seven portrait v2 dimensions, evidence lineage, worker recomputation stability, and duplicate-account safety
- **AND** it SHALL report blockers separately from ordinary learner data gaps.
