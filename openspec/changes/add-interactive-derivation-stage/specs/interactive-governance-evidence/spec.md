## ADDED Requirements

### Requirement: Derivation stage evidence supports teacher diagnostics
Derivation stage interactions SHALL produce backend evidence for reveal progress, formula focus, and misconception analysis.

#### Scenario: Student views and submits a derivation stage
- **WHEN** a student interacts with a derivation stage
- **THEN** evidence SHALL include stage id, max reveal step seen, visited reveal steps, formula block focus events, active highlight ids, and student answers by reveal step
- **AND** the evidence SHALL be associated with lesson id, step id, module id, role, and timestamp.

#### Scenario: Teacher reviews derivation diagnostics
- **WHEN** the teacher opens diagnostics for a derivation stage
- **THEN** the system SHALL show reveal step distribution, unvisited step counts, formula block focus distribution, submitted count, and common misconceptions by reveal step
- **AND** teacher diagnostics SHALL NOT expose implementation-only ids as visible teaching labels.
