## MODIFIED Requirements

### Requirement: Time-domain view auto-ranges visible curves
The time-domain response view SHALL compute its default vertical range from the finite extrema of the currently visible time-domain curves, include approximately 10% visual margin, and SHALL NOT apply fixed equal-aspect Cartesian constraints to time-domain response axes.

#### Scenario: Visible response curves determine axis range
- **WHEN** reference, uncorrected output, corrected output, or other configured visible signals contain finite samples
- **THEN** the time-domain view SHALL choose a y-axis range that contains their minimum and maximum values
- **AND** it SHALL add approximately 10% margin relative to the visible curve span or magnitude.

#### Scenario: Flat or near-flat response remains readable
- **WHEN** the visible curves have a near-zero vertical span
- **THEN** the time-domain view SHALL apply a minimum readable vertical span
- **AND** it SHALL NOT collapse the plot around a single value.

#### Scenario: Reference signal contributes to range
- **WHEN** the reference signal is visible together with response curves
- **THEN** the default y-axis range SHALL include the reference signal values.

#### Scenario: Time-domain chart does not use equal aspect
- **WHEN** a time-domain response panel has a wide time range such as 0 to 12 seconds and response values near 0 to 1.2
- **THEN** the default y-axis range SHALL remain close to the visible response range with margin
- **AND** the y-axis SHALL NOT be expanded to match x-axis units per pixel.

#### Scenario: Data changes reset stale automatic y range
- **WHEN** the selected visible signals, selected object, response type, or analysis result identity changes
- **THEN** the time-domain view SHALL recompute the automatic y-axis range from the new visible data
- **AND** it SHALL NOT preserve an old y-axis range unless the user explicitly panned, zoomed, or refreshed the range.

### Requirement: Frequency views expose valid options only
Bode and Nyquist views SHALL expose only source curves that exist for the current session. Bode MAY allow valid curve overlays through checkable panel-local controls, while Nyquist SHALL render one selected source at a time.

#### Scenario: Bode shows correction device in classic preset
- **WHEN** correction is enabled in the classic preset
- **THEN** the Bode view MAY offer uncorrected open loop, corrected open loop, and correction device curves.

#### Scenario: Bode controls serve as legend
- **WHEN** the Bode view offers multiple selectable curves
- **THEN** each checkable control SHALL show the curve label, color, and line style from the shared style preset
- **AND** the chart drawing area SHALL NOT render a separate legend that duplicates or conflicts with those controls.

#### Scenario: Nyquist renders one selected source
- **WHEN** a student selects a Nyquist source such as corrected open loop
- **THEN** the Nyquist view SHALL render the selected source only
- **AND** it SHALL NOT overlay uncorrected and corrected Nyquist curves in the same panel.

#### Scenario: Nyquist switches correction source
- **WHEN** correction is enabled and both uncorrected and corrected Nyquist curves are available
- **THEN** the Nyquist view SHALL provide a control to select uncorrected or corrected source data
- **AND** the selected source SHALL be identifiable in the view.

#### Scenario: Nyquist source switch is visible in the panel
- **WHEN** a Nyquist panel is rendered in a correction-enabled classic workbench context
- **THEN** the uncorrected/corrected source switch SHALL be visible in or adjacent to the Nyquist panel header
- **AND** the layout composition layer SHALL NOT be the only place where the Nyquist source can be changed.

### Requirement: Panel controls are local to each panel header
Each workbench panel SHALL expose its configuration through a control in that panel's title area, and the layout composition layer SHALL be responsible only for panel add, remove, reorder, and reset behavior.

#### Scenario: Panel configuration opens from title area
- **WHEN** a student clicks a panel's configuration control
- **THEN** the workbench SHALL show the configuration options that apply to that panel's view type
- **AND** the configuration UI SHALL be visually associated with that panel.

#### Scenario: Time-domain Bode and root-locus behavior is preserved
- **WHEN** a student configures a time-domain, Bode, or root-locus panel
- **THEN** the available options and selection behavior SHALL remain equivalent to the previous workbench configuration behavior for that view type.

#### Scenario: One panel configuration does not affect another panel
- **WHEN** a student changes selected options in one panel instance
- **THEN** only that panel instance SHALL update
- **AND** another panel with the same view type SHALL keep its previous selected options.

#### Scenario: Layout does not render view-specific settings
- **WHEN** the workbench layout renders panel instances
- **THEN** it SHALL provide structural actions such as add, remove, reorder, or reset
- **AND** it SHALL NOT render time-domain, Bode, root-locus, or Nyquist specific configuration controls outside the corresponding panel.

## ADDED Requirements

### Requirement: Selectable chart series match panel controls
Time-domain and Bode chart panels SHALL render exactly the selected available series declared by their panel-local controls.

#### Scenario: Time-domain curve is hidden after deselection
- **WHEN** a student deselects a time-domain curve such as reference, uncorrected output, or corrected output
- **THEN** the corresponding rendered series SHALL be removed from the chart
- **AND** tooltip or chart state SHALL NOT continue to expose the deselected series.

#### Scenario: Bode curve is hidden after deselection
- **WHEN** a student deselects a Bode curve such as uncorrected open loop, corrected open loop, or correction device
- **THEN** the corresponding magnitude and phase series SHALL be removed from the chart
- **AND** the remaining rendered curves SHALL match the selected control states.

### Requirement: Chart panel wrappers keep stable dimensions
Workbench chart panel wrappers SHALL keep stable dimensions while source and curve controls are toggled.

#### Scenario: Root-locus source switch does not change wrapper height
- **WHEN** a student switches root-locus source between uncorrected and corrected data
- **THEN** the containing panel module SHALL keep the same reserved height
- **AND** only the plotted content and selected-state indication SHALL change.

#### Scenario: Shared chart panels do not resize on option changes
- **WHEN** a student toggles time-domain, Bode, Nyquist, or root-locus options
- **THEN** surrounding layout modules SHALL NOT jump in height or width because of the toggle state.
