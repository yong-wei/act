## ADDED Requirements

### Requirement: Teacher delivery controls are print-only

The teacher report delivery header SHALL provide the browser print action and SHALL NOT render or invoke a direct PDF-export action. This UI constraint SHALL NOT change the student-safe delivery surface.

#### Scenario: Teacher opens a fixed report

- **WHEN** an authorized teacher opens the teacher delivery page
- **THEN** the header SHALL show the print control
- **AND** SHALL NOT show an export-PDF control or issue a PDF request.

#### Scenario: Student opens a safe report

- **WHEN** an authenticated student opens a student-safe report with an available PDF address
- **THEN** the student delivery surface MAY continue to expose its PDF export action.
