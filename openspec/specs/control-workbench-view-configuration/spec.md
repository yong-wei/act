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
The time-domain view SHALL support configurable signal visibility based on available session data and SHALL keep rendered curve styles synchronized with legend styles.

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
- **AND** the legend sample for the reference signal SHALL use the same dashed style and color.

#### Scenario: Output legend styles match curves
- **WHEN** uncorrected output and corrected output are visible
- **THEN** each legend sample SHALL use the same color and line style as its rendered curve.

### Requirement: Frequency views expose valid options only
Bode and Nyquist views SHALL expose only source curves that exist for the current session, and Nyquist SHALL allow explicit source switching when correction is enabled.

#### Scenario: Bode shows correction device in classic preset
- **WHEN** correction is enabled in the classic preset
- **THEN** the Bode view MAY offer uncorrected open loop, corrected open loop, and correction device curves.

#### Scenario: Nyquist overlay is bounded
- **WHEN** Nyquist supports overlay in a session
- **THEN** it SHALL allow at most uncorrected and corrected open-loop curves together.

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
Workbench view configuration SHALL persist while the student remains in the active browser session.

#### Scenario: Configuration survives local navigation in the workbench
- **WHEN** a student changes a view option and continues working in the same workbench session
- **THEN** the option SHALL remain selected until reset or session exit.

### Requirement: Time-domain view auto-ranges visible curves
The time-domain response view SHALL compute its default vertical range from the finite extrema of the currently visible time-domain curves and include approximately 10% visual margin.

#### Scenario: Visible response curves determine axis range
- **WHEN** reference, uncorrected output, or corrected output curves are visible and contain finite samples
- **THEN** the time-domain view SHALL choose a y-axis range that contains their minimum and maximum values
- **AND** it SHALL add approximately 10% margin relative to the visible curve span or magnitude.

#### Scenario: Flat or near-flat response remains readable
- **WHEN** the visible curves have a near-zero vertical span
- **THEN** the time-domain view SHALL apply a minimum readable vertical span
- **AND** it SHALL NOT collapse the plot around a single value.

