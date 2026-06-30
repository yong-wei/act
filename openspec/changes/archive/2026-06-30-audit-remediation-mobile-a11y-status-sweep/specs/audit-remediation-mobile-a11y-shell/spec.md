## ADDED Requirements

### Requirement: Mobile a11y sweep shall close only behavior-backed states
The mobile and accessibility sweep SHALL close remaining findings only when the underlying business action has a valid state machine or recovery state.

#### Scenario: a status/live or mobile finding is evaluated
- **WHEN** a status/live or mobile finding is evaluated
- **THEN** the reviewer SHALL confirm the relevant vertical action, recovery, or writeback behavior exists before closing the horizontal finding.

#### Scenario: the finding is purely shell-level
- **WHEN** the finding is purely shell-level
- **THEN** validation SHALL include 320px and 390px viewport evidence, focus order, role/status/alert output, and floating-tool avoidance.

### Requirement: Global floating tools shall not outrank page recovery or primary actions
Global AI, floating tools, mobile navigation, and dialogs SHALL preserve page primary action priority and focus containment.

#### Scenario: a page enters mobile, error, report, grading, governance, path, or evidence state
- **WHEN** a page enters mobile, error, report, grading, governance, path, or evidence state
- **THEN** the primary page action or recovery action SHALL remain reachable before global secondary tools.

#### Scenario: a dialog, menu, side panel, or floating tool opens
- **WHEN** a dialog, menu, side panel, or floating tool opens
- **THEN** focus SHALL be contained, Escape behavior SHALL be defined, and focus SHALL return to the opener when closed.
