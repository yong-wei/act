## ADDED Requirements

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
Each workbench panel SHALL expose its configuration through a control in that panel's title area.

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

## MODIFIED Requirements

### Requirement: Frequency views expose valid options only
Bode and Nyquist views SHALL expose only source curves that exist for the current session. Bode MAY allow valid curve overlays, while Nyquist SHALL render one selected source at a time.

#### Scenario: Bode shows correction device in classic preset
- **WHEN** correction is enabled in the classic preset
- **THEN** the Bode view MAY offer uncorrected open loop, corrected open loop, and correction device curves.

#### Scenario: Nyquist renders one selected source
- **WHEN** a student selects a Nyquist source such as corrected open loop
- **THEN** the Nyquist view SHALL render the selected source only
- **AND** it SHALL NOT overlay uncorrected and corrected Nyquist curves in the same panel.

### Requirement: View configuration persists for the active session
Workbench panel configuration SHALL persist by panel instance while the student remains in the active browser session.

#### Scenario: Panel configuration survives local navigation in the workbench
- **WHEN** a student changes a view option in a panel and continues working in the same workbench session
- **THEN** that panel's option SHALL remain selected until reset or session exit
- **AND** sibling panels SHALL keep their own configuration state.
