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

