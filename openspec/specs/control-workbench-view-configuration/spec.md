# control-workbench-view-configuration Specification

## Purpose
TBD - created by archiving change workbench-view-configuration. Update Purpose after archive.
## Requirements
### Requirement: Workbench views declare availability
Each workbench view SHALL declare whether it is available for the current session context and why it may be unavailable.

#### Scenario: Root locus unavailable for black-box official target
- **WHEN** the current session has no public SISO LTI transfer function and no nominal model
- **THEN** the root-locus view SHALL be unavailable
- **AND** the UI SHALL show a Chinese explanation instead of a chart.

### Requirement: Time-domain view supports signal selection
The time-domain view SHALL support configurable signal visibility based on available session data, and its panel-local signal controls SHALL be the visible legend for rendered curves.

#### Scenario: Classic white-box default signals
- **WHEN** the classic preset loads
- **THEN** the time-domain view SHALL default to reference, uncorrected output, and corrected output when available.

#### Scenario: Unsupported signal is disabled
- **WHEN** a signal such as black-box output is not available in the current session
- **THEN** its selector SHALL be disabled
- **AND** the view SHALL NOT synthesize placeholder data for it.

#### Scenario: Reference signal is dashed
- **WHEN** the reference signal is visible in the time-domain response view
- **THEN** it SHALL be rendered as a dashed curve
- **AND** the panel-local selector sample for the reference signal SHALL use the same dashed style and color.

#### Scenario: Output control styles match curves
- **WHEN** uncorrected output and corrected output are visible
- **THEN** each panel-local selector sample SHALL use the same color and line style as its rendered curve.

#### Scenario: Chart area has no separate time-domain legend
- **WHEN** the time-domain panel renders configurable signal controls
- **THEN** the chart drawing area SHALL NOT render a separate legend that duplicates or conflicts with those controls.

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

### Requirement: Root locus uses single selected source
The root-locus view SHALL render one selected source at a time and SHALL support uncorrected/corrected source switching when correction is enabled.

#### Scenario: User selects corrected source
- **WHEN** the student selects corrected root locus
- **THEN** the root-locus view SHALL render the corrected source only
- **AND** it SHALL not overlay the uncorrected root locus.

#### Scenario: User selects uncorrected source
- **WHEN** correction is enabled and the student selects uncorrected root locus
- **THEN** the root-locus view SHALL render the uncorrected source only
- **AND** the selected source SHALL be identifiable in the view.

### Requirement: View configuration persists for the active session
Workbench panel configuration SHALL persist by panel instance while the student remains in the active browser session.

#### Scenario: Panel configuration survives local navigation in the workbench
- **WHEN** a student changes a view option in a panel and continues working in the same workbench session
- **THEN** that panel's option SHALL remain selected until reset or session exit
- **AND** sibling panels SHALL keep their own configuration state.

### Requirement: Time-domain view auto-ranges visible curves
The time-domain response view SHALL compute its default vertical range from the finite extrema of the currently visible time-domain curves, include approximately 10% visual margin, and avoid fixed aspect-ratio constraints that prevent data-driven vertical display.

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

### Requirement: Workbench layout is composed of panel instances
The control workbench SHALL render analysis views as ordered panel instances rather than as one global instance per view type.

#### Scenario: Challenge mode loads default panel instances
- **WHEN** a student opens a challenge-bound workbench
- **THEN** the workbench SHALL initialize a default ordered set of panel instances for that challenge mode or preset
- **AND** each panel instance SHALL have its own identity, view type, title, selected options, and settings.

#### Scenario: Student can add allowed panel type
- **WHEN** a student chooses to add a panel type that is allowed for the current session
- **THEN** the workbench SHALL add a new panel instance of that view type
- **AND** the new instance SHALL use valid default configuration for that view type.

#### Scenario: Student can open multiple same-type panels
- **WHEN** a student adds a second panel with the same view type as an existing panel
- **THEN** both panel instances SHALL remain visible
- **AND** each instance SHALL keep independent selected options and settings.

#### Scenario: Student can remove a panel
- **WHEN** a student removes a panel instance
- **THEN** that panel SHALL disappear from the layout
- **AND** removing it SHALL NOT reset the configuration of remaining panels.

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

