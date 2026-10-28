## ADDED Requirements

### Requirement: Active knowledge workspace uses a theme-aware instrument palette

The new knowledge graph workspace SHALL paint its canvas glyphs, relation strokes, labels, root bubbles, legend bar and inspector from platform token roles so that every element stays legible in both the default dark theme and the light theme. Migrated canvas and panel code SHALL NOT use raw hexadecimal colours or slate/sky/cyan/amber/emerald/fuchsia/red utility hues for meaning-bearing state.

#### Scenario: Theme switches while a domain is open

- **WHEN** the user switches between dark and light theme with a domain view open
- **THEN** node glyphs, relation strokes, labels and the legend SHALL repaint with the theme's token values without recomputing coordinates, pan or zoom
- **AND** label text SHALL keep at least WCAG AA contrast against the canvas background.

#### Scenario: Root bubble encodes size and state

- **WHEN** the root view is visible
- **THEN** each domain bubble's radius SHALL follow the domain's knowledge-point count within documented bounds
- **AND** its fill tone SHALL encode the learner's domain mastery state when mastery data is ready, or a neutral domain tone otherwise.

### Requirement: Inspector and workspace toolbar never overlap

The desktop node inspector overlay SHALL be inset so that the workspace toolbar (version, dimension, fit, relayout and return controls) remains fully visible and clickable while the inspector is open.

#### Scenario: Inspector opens on desktop

- **WHEN** a desktop user selects a node at 1440×900
- **THEN** the inspector's bounding box SHALL NOT intersect the toolbar's bounding box
- **AND** the inspector's close control and the toolbar's return control SHALL both remain reachable.

#### Scenario: Inspector lists relations

- **WHEN** the inspector lists incoming and outgoing relations
- **THEN** each row SHALL present direction, relation label and the peer's display name concisely
- **AND** activating the peer SHALL select that node without resizing the layout.

### Requirement: Relation family absence is distinguished from load failure

The legend bar SHALL distinguish a relation family that is not published for the current domain from a family that failed to load.

#### Scenario: Family shard is not published

- **WHEN** enabling a relation family returns a "shard absent" result for the current domain
- **THEN** the legend SHALL show a neutral note stating that this domain has no relations of that family
- **AND** it SHALL NOT render error styling or a retry action for that family.

#### Scenario: Family shard fails to load

- **WHEN** enabling a relation family fails for any other reason
- **THEN** the legend SHALL show an error-toned message with a retry action
- **AND** retrying SHALL re-request only that family.
