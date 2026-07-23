## ADDED Requirements

### Requirement: Visible snapshots are identifiable in all classic comparison views
The time-domain, Bode, root-locus, and Nyquist views of a classic workbench SHALL render the current design together with each visible snapshot that has a valid analysis result. A snapshot SHALL use the same stable color and name in every view, and the UI SHALL identify the corresponding comparison series.

#### Scenario: Student compares a current design with a snapshot
- **WHEN** the current design and a saved snapshot both have valid analysis results and the snapshot is visible
- **THEN** each classic comparison view SHALL render both results together
- **AND** the snapshot series SHALL be identified by its saved name and stable color.

#### Scenario: Snapshot analysis is unavailable
- **WHEN** a visible snapshot cannot produce a valid result for a comparison view
- **THEN** the view SHALL retain the current design result
- **AND** it SHALL not render synthetic or stale snapshot data as a valid curve.

## MODIFIED Requirements

### Requirement: Frequency views expose valid options only
Frequency views SHALL expose only source curves and visible snapshots that have valid analysis data for the current session. Bode SHALL allow valid current-design curve overlays through panel-local controls and SHALL render visible snapshot comparison curves. Nyquist SHALL preserve a selectable current-design source and SHALL render visible snapshot comparison curves without making them editable.

#### Scenario: Bode shows correction device in classic preset
- **WHEN** correction is enabled in the classic preset
- **THEN** the Bode view SHALL offer uncorrected open loop, corrected open loop, and correction device curves for the current design.

#### Scenario: Bode controls serve as current-design legend
- **WHEN** the Bode view offers multiple current-design curves
- **THEN** each checkable control SHALL show the curve label, color, and line style from the shared style preset
- **AND** snapshot comparison series SHALL be identified by the snapshot management UI or a non-conflicting comparison legend.

#### Scenario: Nyquist renders selected source with snapshots
- **WHEN** a student selects a Nyquist source such as corrected open loop and one or more snapshots are visible
- **THEN** the Nyquist view SHALL render the selected current-design source and each valid visible snapshot
- **AND** snapshot series SHALL not expose current-design interaction controls.

#### Scenario: Nyquist source switch is visible in the panel
- **WHEN** a Nyquist panel is rendered in a correction-enabled classic workbench context
- **THEN** the uncorrected/corrected current-design source switch SHALL be visible in or adjacent to the Nyquist panel header
- **AND** the layout composition layer SHALL NOT be the only place where the Nyquist source can be changed.

### Requirement: Root locus uses selected current source with static snapshot overlays
The root-locus view SHALL render one selected current-design source at a time and SHALL support uncorrected/corrected current-design source switching when correction is enabled. It SHALL overlay each valid visible snapshot as a static, identifiable comparison series.

#### Scenario: User selects corrected current source
- **WHEN** the student selects corrected root locus
- **THEN** the root-locus view SHALL render the corrected current-design source
- **AND** it SHALL preserve visible snapshot comparison series.

#### Scenario: Snapshot root locus is static
- **WHEN** a visible snapshot is rendered in a root-locus view
- **THEN** its trace and markers SHALL use the snapshot's saved analysis result
- **AND** dragging a current-design correction handle SHALL NOT mutate the snapshot.

#### Scenario: User selects uncorrected current source
- **WHEN** correction is enabled and the student selects uncorrected root locus
- **THEN** the root-locus view SHALL render the uncorrected current-design source
- **AND** the selected current source SHALL be identifiable in the view.
