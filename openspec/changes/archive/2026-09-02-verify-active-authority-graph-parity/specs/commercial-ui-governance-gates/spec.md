## ADDED Requirements

### Requirement: Active graph UI evidence is exact-revision and denominator-complete
Commercial UI governance SHALL reject active graph evidence unless it is bound to the exact capture revision and covers the declared role, viewport, dimension, locale, navigation-level and control-state denominator.

#### Scenario: Evidence is stale or incomplete
- **WHEN** any relevant graph source hash changes or a required matrix state is absent
- **THEN** the active graph UI gate SHALL fail
- **AND** older screenshots or source assertions SHALL not provide clearance
