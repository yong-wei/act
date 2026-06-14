## ADDED Requirements

### Requirement: Adaptive path generation is always actionable
The student-facing adaptive learning center SHALL provide a usable path generation state for every authenticated learner.

#### Scenario: Cold-start student opens adaptive learning
- **WHEN** a student without enough learning evidence opens `/assessment/adaptive-practice`
- **THEN** the page SHALL offer generic learning path generation and starter path options
- **AND** it SHALL use language such as `证据还少，先从入门路径开始，系统会随学习过程调整。`
- **AND** it SHALL NOT display no-path failure, readiness-gate internals, or raw diagnostic reason codes.

### Requirement: Student path payloads hide internal reason codes
Adaptive learning center UI SHALL convert internal readiness and diagnostic states into product language before rendering student surfaces.

#### Scenario: Planner returns internal diagnostics
- **WHEN** planner or Konling context includes internal states such as `missing-*`, `low-evidence`, `no-path`, `stage`, or `policyFamily`
- **THEN** student-facing UI SHALL render student-readable next actions and limitations
- **AND** those raw strings SHALL remain absent from visible text, accessible labels, and student JSON embedded in the page.

## MODIFIED Requirements

### Requirement: Adaptive claims expose confidence and evidence limits
The system SHALL represent source coverage, confidence, privacy scope, and evidence limitations in product language for students and diagnostic language only for authorized teacher/admin surfaces.

#### Scenario: Path personalization is low confidence
- **WHEN** a path, recommendation, mastery state, or Konling intervention is based on weak or incomplete evidence
- **THEN** the student UI SHALL explain the next usable action and why personalization will improve later
- **AND** internal limiting reason codes SHALL NOT appear in the student path center.
