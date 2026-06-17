## ADDED Requirements

### Requirement: Annotated media is a registered visual module
The interactive module taxonomy SHALL support `visual.annotatedMedia` for evidence-bearing media surfaces.

#### Scenario: Annotated media is authored
- **WHEN** a runtime manifest declares `kind: visual.annotatedMedia`
- **THEN** the registry SHALL validate media source, alt text, annotation ids, normalized regions, evidence roles, reveal step references, and selectable annotation metadata
- **AND** the renderer SHALL be shared by manifest runtime rather than a lesson-private image wrapper.

#### Scenario: Media text leaks implementation details
- **WHEN** a media title, caption, annotation label, fallback, or visible diagnostic contains a file path, module kind, renderer name, payload key, or internal id
- **THEN** validation SHALL fail
- **AND** the failure SHALL identify the visible text source.

### Requirement: Embedded activity is a registered visual activity layer
Interactive course visuals SHALL support embedded activity anchors that collect answers inside the visual surface.

#### Scenario: Activity is embedded in a visual surface
- **WHEN** a visual stage or annotated media module includes an embedded activity
- **THEN** the activity SHALL declare a canonical response contract
- **AND** it SHALL use shared activity submission evidence rather than a course-private data path.
