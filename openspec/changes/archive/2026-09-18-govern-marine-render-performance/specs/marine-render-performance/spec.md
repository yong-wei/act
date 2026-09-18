## ADDED Requirements

### Requirement: Performance evidence states its measurement context
Performance evidence SHALL identify hardware, browser, drawing-buffer size, scene inputs and measurement method, and SHALL distinguish measured results from targets.

#### Scenario: No GPU timer extension exists
- **WHEN** the benchmark runs without timer-query support
- **THEN** the report marks GPU timing unavailable and does not relabel frame intervals as GPU duration

### Requirement: Degradation preserves scene and teaching semantics
Quality degradation SHALL reduce rendering work without changing the base wave field, pose ownership or numerical results.

#### Scenario: Frame budget is exceeded
- **WHEN** the governor selects a cheaper quality configuration
- **THEN** additional visual costs are reduced while the declared interaction wave and task state remain stable

### Requirement: Resources have bounded lifetimes
Scene resources SHALL be reused or released according to ownership and SHALL not accumulate unboundedly during preset or route changes.

#### Scenario: Repeated transitions complete
- **WHEN** the test completes ten preset changes and repeated route cycles
- **THEN** resource counts and estimated render-target memory return to a documented steady-state range
