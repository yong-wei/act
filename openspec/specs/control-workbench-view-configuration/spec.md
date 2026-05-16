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
The time-domain view SHALL support configurable signal visibility based on available session data.

#### Scenario: Classic white-box default signals
- **WHEN** the classic preset loads
- **THEN** the time-domain view SHALL default to reference, uncorrected output, and corrected output when available.

#### Scenario: Unsupported signal is disabled
- **WHEN** a signal such as black-box output is not available in the current session
- **THEN** its selector SHALL be disabled
- **AND** the view SHALL NOT synthesize placeholder data for it.

### Requirement: Frequency views expose valid options only
Bode and Nyquist views SHALL expose only source curves that exist for the current session.

#### Scenario: Bode shows correction device in classic preset
- **WHEN** correction is enabled in the classic preset
- **THEN** the Bode view MAY offer uncorrected open loop, corrected open loop, and correction device curves.

#### Scenario: Nyquist overlay is bounded
- **WHEN** Nyquist supports overlay in a session
- **THEN** it SHALL allow at most uncorrected and corrected open-loop curves together.

### Requirement: Root locus uses single selected source
The root-locus view SHALL render one selected source at a time.

#### Scenario: User selects corrected source
- **WHEN** the student selects corrected root locus
- **THEN** the root-locus view SHALL render the corrected source only
- **AND** it SHALL not overlay the uncorrected root locus.

### Requirement: View configuration persists for the active session
Workbench view configuration SHALL persist while the student remains in the active browser session.

#### Scenario: Configuration survives local navigation in the workbench
- **WHEN** a student changes a view option and continues working in the same workbench session
- **THEN** the option SHALL remain selected until reset or session exit.

