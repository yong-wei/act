## MODIFIED Requirements

### Requirement: Parameter drawer tab layout is stable
The parameter drawer SHALL use native tab semantics for top-level object and correction labels, and those tabs SHALL remain readable, visually stable, and clearly active as the selected object, correction state, or correction structure changes.

#### Scenario: Switching structures does not deform tabs
- **WHEN** a student switches between PI, PD, PID, lead, lag, and lead-lag
- **THEN** tab labels SHALL remain visible
- **AND** the active tab indication SHALL continue to identify the current tab.

#### Scenario: Clicking object and correction labels keeps header dimensions stable
- **WHEN** a student clicks the object label, correction label, or toggles correction state
- **THEN** the drawer header SHALL keep a stable height, width allocation, and spacing
- **AND** no top-level label SHALL push adjacent controls out of position.

#### Scenario: Active tab is theme-aware
- **WHEN** the drawer is rendered in either light or dark theme
- **THEN** the active object or correction tab SHALL use a distinct active color treatment
- **AND** inactive, hover, and focus states SHALL remain distinguishable from the active state.

#### Scenario: Long labels stay bounded
- **WHEN** the selected object name or correction label is longer than the available header space
- **THEN** the label SHALL be truncated, wrapped within a fixed bound, or otherwise constrained
- **AND** it SHALL NOT stretch or deform the drawer header.

#### Scenario: Current label changes color without resizing
- **WHEN** a student switches between the object label and a correction label
- **THEN** the newly current label SHALL change to the active color treatment
- **AND** the label dimensions SHALL remain stable during the state change.

#### Scenario: Native tabs replace simulated labels
- **WHEN** the parameter drawer renders object and correction top-level controls
- **THEN** those controls SHALL use the repository's native tab component or equivalent native tab semantics
- **AND** they SHALL NOT be implemented as unrelated buttons that only imitate tab styling.
