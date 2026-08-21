## ADDED Requirements

### Requirement: Diagnosis delivery controls are print-only

The teacher and student-safe report delivery headers SHALL provide the browser print action and SHALL NOT render or invoke a direct PDF-export action. Existing server-side PDF artifacts, audit records, and already-published PDF endpoints are outside this UI change.

#### Scenario: Teacher opens a fixed report

- **WHEN** an authorized teacher opens the teacher delivery page
- **THEN** the header SHALL show the print control
- **AND** SHALL NOT show an export-PDF control or issue a PDF request.

#### Scenario: Student opens a safe report

- **WHEN** an authenticated student opens a student-safe report
- **THEN** the header SHALL show the print control
- **AND** SHALL NOT show an export-PDF control or issue a PDF request.
