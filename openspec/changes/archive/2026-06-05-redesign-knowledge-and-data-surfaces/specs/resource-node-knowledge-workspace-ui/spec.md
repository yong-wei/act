## ADDED Requirements

### Requirement: Knowledge workspace is canvas-first on mobile
The ResourceNode knowledge workspace SHALL prioritize the graph/canvas on mobile.

#### Scenario: Knowledge graph renders at 320px width
- **WHEN** `/knowledge` opens on mobile
- **THEN** the graph or canvas area SHALL be visible as the primary surface
- **AND** chapter directory, relation filters, legends, and resource panels SHALL open through drawers, sheets, or focused panels rather than permanent side-by-side columns.

### Requirement: Knowledge controls do not block launch or dock actions
The ResourceNode workspace SHALL coordinate filters, legends, node panels, launch actions, and floating dock placement.

#### Scenario: Filters or node panels are open
- **WHEN** a user opens relation filters, chapter filters, legend, or ResourceNode panel
- **THEN** primary launch, close, return, and dock controls SHALL remain reachable and non-overlapping.

### Requirement: Knowledge workspace launches real learning resources
The ResourceNode knowledge workspace SHALL connect graph exploration to actual learning resources and evidence review.

#### Scenario: Knowledge node with launchable resource is selected
- **WHEN** a selected node has a registered ResourceNode, course resource, simulation, lesson entry, or evidence target
- **THEN** the UI SHALL expose the launch action and return path
- **AND** the knowledge graph SHALL NOT be accepted as a decorative graph with no connection to learning paths, resources, or evidence.
