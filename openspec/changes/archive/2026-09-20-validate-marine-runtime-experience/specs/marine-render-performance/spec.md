## ADDED Requirements

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
