## ADDED Requirements

### Requirement: Simulation workspace surfaces match handoff composition
Commercial simulation workspace surfaces SHALL demonstrate Product Design handoff composition, not only platform-token usage or `data-*` markers.

#### Scenario: Simulation local workspace is reviewed
- **WHEN** a simulation detail route changes local telemetry, controls, hints, bottom tools, or mission evidence surfaces
- **THEN** evidence SHALL show the accepted handoff relationship among scene, telemetry panel, control/evaluation panel, bottom toolbar, hint strip, and shared dock
- **AND** the review SHALL fail if the page merely wraps the existing scene in large opaque cards, repeated panels, or grid columns without the accepted immersive command-deck composition.

### Requirement: Simulation mobile command surfaces preserve task access
Simulation mobile layouts SHALL translate secondary controls into reachable command surfaces without squeezing desktop side rails into the viewport.

#### Scenario: 320px simulation evidence is reviewed
- **WHEN** a simulation detail route is captured at 320px width
- **THEN** the primary scene or instrument area SHALL remain visible before secondary-control overflow
- **AND** telemetry, control, bottom tool, hint, and Konling surfaces SHALL remain reachable through drawer, sheet, tab, collapse, or command-surface behavior
- **AND** the layout SHALL NOT rely on permanent desktop side panels.
