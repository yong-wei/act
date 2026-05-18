## MODIFIED Requirements

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
