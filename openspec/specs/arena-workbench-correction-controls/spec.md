## Purpose
Define correction-control editing, controller expressions, Chinese display text, and three-domain synchronization in the Arena workbench.

## Requirements

### Requirement: Workbench text and formulas are Chinese and LaTeX-rendered
The multi-representation workbench SHALL use Chinese visible text and LaTeX-rendered formulas for Arena challenge context, controller expressions, object models, and status summaries.

#### Scenario: Arena workbench has no English status headings
- **WHEN** a student opens the multi-representation workbench from an Arena challenge
- **THEN** headings and status messages SHALL be Chinese
- **AND** phrases such as `Multi Representation Linkage`, `Workbench Mismatch`, and `Arena Challenge Error` SHALL NOT be visible.

#### Scenario: Controller expression updates as formula
- **WHEN** the selected correction structure or parameter values change
- **THEN** the controller expression displayed below the structure selector SHALL update
- **AND** it SHALL be rendered as LaTeX.

### Requirement: Correction device owns all controller parameters
When correction is enabled, all adjustable controller parameters including open-loop gain SHALL be edited in the correction device section of the parameter drawer.

#### Scenario: Gain appears in correction section
- **WHEN** correction is enabled in the parameter drawer
- **THEN** controller gain SHALL be shown in the correction device parameter inputs
- **AND** the plant/object tab SHALL NOT present that gain as an object parameter.

#### Scenario: PID family shows only applicable parameters
- **WHEN** the selected structure is PI, PD, or PID
- **THEN** the drawer SHALL show only the controller parameters applicable to that structure
- **AND** official submission artifacts SHALL use the same effective parameters.

#### Scenario: Lead and lag families include controller gain
- **WHEN** the selected structure is lead, lag, or lead-lag
- **THEN** the drawer SHALL show controller gain and the relevant zero/pole frequency or time-constant parameters
- **AND** the generated controller SHALL include that gain.

### Requirement: Numeric inputs support stable editing
Parameter drawer numeric inputs SHALL use step 1, display two decimal places when not actively editing, and support full-value replacement while typing.

#### Scenario: Student replaces a number
- **WHEN** a student selects the entire numeric input value and types a replacement
- **THEN** the input SHALL accept the replacement without immediately restoring the previous formatted value.

#### Scenario: Numeric input uses two-decimal display
- **WHEN** a parameter input is not actively being edited
- **THEN** finite numeric values SHALL display with two digits after the decimal point.

### Requirement: Parameter drawer tab layout is stable
The parameter drawer SHALL keep tab labels readable and visually stable as the selected correction structure changes.

#### Scenario: Switching structures does not deform tabs
- **WHEN** a student switches between PI, PD, PID, lead, lag, and lead-lag
- **THEN** tab labels SHALL remain visible
- **AND** the active tab indication SHALL continue to identify the current tab.

### Requirement: Time-domain chart auto range reflects stable response
The stable time-domain response chart SHALL default its y-axis range to cover 1.1 times the maximum response signal magnitude.

#### Scenario: Stable response gets bounded default range
- **WHEN** the current analysis result is stable and has finite step-response points
- **THEN** the time-domain panel SHALL compute a default y-axis range from the response signal maximum multiplied by 1.1
- **AND** manual pan or zoom SHALL still preserve the user-selected range.

### Requirement: Root-locus gain and correction handles stay synchronized
The root-locus view SHALL use the effective controller gain and SHALL synchronize draggable correction zero/pole handles with the parameter drawer.

#### Scenario: Root locus status shows effective gain
- **WHEN** the full root-locus panel renders in the multi-representation workbench
- **THEN** its status area SHALL show the current effective open-loop gain in Chinese.

#### Scenario: Dragging correction handle updates drawer
- **WHEN** a student drags a correction zero or pole on the root-locus chart
- **THEN** the corresponding parameter drawer value SHALL update to the same effective zero or pole frequency.

#### Scenario: Drawer update moves root handle
- **WHEN** a student edits a correction zero or pole parameter in the drawer
- **THEN** the root-locus handle SHALL move to the corresponding position.

#### Scenario: Closed-loop poles use equivalent gain
- **WHEN** controller gain is changed through the correction controls
- **THEN** the root-locus closed-loop pole markers SHALL be computed from the same effective gain used for official artifact generation.
