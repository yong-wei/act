## MODIFIED Requirements

### Requirement: Active semantic filters live in one dedicated panel
The active workspace SHALL provide relation-family content filters as compact bottom-left canvas chips matching the old graph control: reversible multi-select labels with registered line samples, including the default teaching-order chip. The chips SHALL sit at the canvas corner (`bottom-0 left-0`, with the established Konling clearance when that launcher is expanded). The global workspace toolbar SHALL contain only graph-version, language, dimension, fit, reflow and domain-return actions and SHALL NOT host relation filters.

#### Scenario: Viewer opens filters on desktop
- **WHEN** an active domain canvas is visible on desktop
- **THEN** teaching-order and engineering-family chips SHALL appear at the bottom-left canvas corner
- **AND** search or layout controls SHALL not duplicate those chips in the top toolbar

#### Scenario: Viewer opens filters on mobile
- **WHEN** the same canvas is opened on a compact viewport
- **THEN** the same chip state SHALL remain available at the bottom-left corner or the established mobile equivalent
- **AND** closing any compact overlay SHALL restore focus without changing the graph
