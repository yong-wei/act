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

### Requirement: Teacher report-level preparation entry is always available

The teacher report disposition area SHALL link to the existing smart preparation workspace without creating a preparation task. This action SHALL remain available when the report is class-scoped or its findings have no knowledge-node mapping.

#### Scenario: Teacher opens a class report without mapped knowledge nodes

- **WHEN** an authorized teacher opens the teacher delivery page for a class report whose findings omit knowledge-node identifiers
- **THEN** the report disposition area SHALL show the smart preparation workspace entry
- **AND** it SHALL NOT create or alter a preparation task.
