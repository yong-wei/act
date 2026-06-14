## ADDED Requirements

### Requirement: Knowledge graph follows the shared dense-workspace surface model
The knowledge graph SHALL use the shared commercial workspace model while keeping graph-specific controls local to the graph surface.

#### Scenario: Knowledge graph workspace renders in the platform shell
- **WHEN** `/knowledge` renders as a dense workspace
- **THEN** AppShell SHALL own global navigation, route trace, theme switching, user center, and floating dock placement
- **AND** knowledge-specific directory, filters, legend, layout, focus, and inspector controls SHALL remain local workspace tools.

#### Scenario: Product Design concepts are used as references
- **WHEN** implementation uses the knowledge graph Product Design concept references
- **THEN** it SHALL adopt the approved workspace organization, dark-mode tone, and light-mode clarity
- **AND** it SHALL NOT introduce a second platform shell, duplicate role switcher, duplicate assistant entry, or pixel-copy generated mockup details.
