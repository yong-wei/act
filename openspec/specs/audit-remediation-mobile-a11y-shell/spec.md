# audit-remediation-mobile-a11y-shell Specification

## Purpose
TBD - created by archiving change audit-remediation-mobile-a11y-shell. Update Purpose after archive.
## Requirements
### Requirement: Audited mobile pages must not overflow the viewport
The system SHALL keep audited 320px and 390px pages within viewport width unless a component is explicitly designed as an internal horizontal scroller with visible affordance.

#### Scenario: Admin users page fits 320px
- **WHEN** `/admin/users` is opened at 320px with role, q, page, or action parameters
- **THEN** document width does not expand to the audited 945px table layout

#### Scenario: Governance page fits 320px
- **WHEN** `/admin/data-governance` is opened at 320px
- **THEN** risk content is readable without document-level horizontal overflow

### Requirement: Long mobile workflows must expose fixed primary actions
The system SHALL provide reachable primary actions for audited long teacher, admin, report, and feedback pages.

#### Scenario: Teacher report primary action remains reachable
- **WHEN** a teacher views a long class report on mobile
- **THEN** export/send/lock or the current primary action is available without scrolling through the entire report

### Requirement: Floating tools and dialogs must preserve accessibility
The system SHALL prevent global floating tools, AI sidebars, and dialogs from covering primary content or leaking focus.

#### Scenario: Dialog contains keyboard focus
- **WHEN** an audited modal is open
- **THEN** Tab remains inside the dialog, Escape closes or reports why it cannot close, and controls have accessible names

#### Scenario: Floating dock avoids content
- **WHEN** audited mobile pages include global or local floating tools
- **THEN** the controls do not cover the current primary content or action

### Requirement: Mobile and a11y fixes must update audit evidence
The system SHALL update the audit report with new 320px/390px screenshots, DOM width data, and a11y evidence before marking mobile findings fixed.

#### Scenario: Mobile finding is closed
- **WHEN** a mobile overflow or focus finding is remediated
- **THEN** the audit entry cites the new screenshot, DOM width, and interaction evidence

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

