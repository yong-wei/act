## ADDED Requirements

### Requirement: Shallow-water optics have a real depth-aware consumer
At least one active shallow-water layout SHALL render depth-aware absorption and bounded refraction using a documented water-thickness interpretation rather than only a preset color gradient.

#### Scenario: Water depth varies beside the vessel
- **WHEN** the shallow-water camera sees the authored bottom and a foreground hull
- **THEN** depth affects the visible water layer coherently and foreground hull edges do not leak unrelated background samples
- **AND** disabling the shallow-water consumer stops its extra rendering work
