# marine-render-performance Specification

## Purpose
TBD - created by archiving change govern-marine-render-performance. Update Purpose after archive.
## Requirements
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

### Requirement: Performance collection targets the active marine renderer
The collector SHALL identify the actual marine rendering context and SHALL not infer it from the first canvas in the document.

#### Scenario: A chart canvas precedes the marine canvas
- **WHEN** the page contains multiple chart and 3D canvases
- **THEN** marine measurements identify the correct drawing buffer and renderer rather than the chart

### Requirement: Measurement windows retain foreground stalls
Foreground long stalls SHALL remain represented in the report, and changes to measured scene conditions SHALL split or annotate the measurement window.

#### Scenario: A foreground frame stalls longer than one second
- **WHEN** collection is active and the tab remains visible
- **THEN** the stall is recorded rather than silently discarded by an upper interval cutoff

### Requirement: Default rendering excludes expensive QA-only traversal
Expensive model inspection intended only for QA SHALL not run every frame during ordinary use.

#### Scenario: A normal simulation session runs without QA enabled
- **WHEN** the high-detail vessel advances
- **THEN** full-model bounds and skeleton integrity inspections are not repeatedly executed solely to populate QA globals

