## ADDED Requirements

### Requirement: Teaching assistant triggers learning diagnosis
The system SHALL support teacher-initiated learning diagnosis generation through the Konling teaching assistant runtime.

#### Scenario: Teacher requests class diagnosis
- **GIVEN** an authorized teacher is in the teaching assistant interface
- **AND** the teacher has class scope authorization
- **WHEN** the teacher clicks "Generate Diagnosis"
- **THEN** the system SHALL initiate a Konling TA diagnosis mode session
- **AND** the session SHALL invoke get_student_risk_flags, get_class_competency_summary, and get_student_knowledge_progress tools
- **AND** the model SHALL produce a structured diagnosis report from the tool results

#### Scenario: Risk flags prompt diagnosis awareness
- **GIVEN** risk flags have been produced by the background scanner
- **WHEN** a teacher opens the teaching assistant dashboard
- **THEN** the dashboard SHALL display risk flag indicators per-class and per-student
- **AND** each indicator SHALL link to the diagnosis generation interface

### Requirement: Background risk scanner
The system SHALL run a deterministic background scan for student risk flags.

#### Scenario: Risk scanner detects stagnation
- **GIVEN** a student knowledge progress has not improved across N consecutive assessment windows
- **WHEN** the risk scanner processes the student progress data
- **THEN** it SHALL create a StudentRiskFlag with type stagnation and appropriate severity
- **AND** it SHALL attach evidence references to the flag

#### Scenario: Risk scanner respects deterministic rules only
- **WHEN** no deterministic rule condition is met
- **THEN** the scanner SHALL NOT create speculative or AI-generated risk flags

### Requirement: Diagnosis report persistence
The system SHALL persist diagnosis reports as structured JSON for historical comparison.

#### Scenario: Diagnosis report is saved after generation
- **WHEN** the Konling diagnosis mode completes report generation
- **THEN** the system SHALL persist the report as a new diagnosis report entry
- **AND** the entry SHALL include the report scope, timestamp, and complete structured report body

#### Scenario: Historical reports are retrievable without AI
- **WHEN** a teacher requests diagnosis history
- **THEN** the system SHALL return previous report entries from the database
- **AND** SHALL NOT re-invoke the AI model

### Requirement: Diagnosis-to-action linking
Diagnosis reports SHALL provide navigation links to the preparation workspace without triggering automatic teaching actions.

#### Scenario: Weak knowledge point links to preparation workspace
- **GIVEN** a diagnosis report identifies a weak knowledge point
- **WHEN** the report is rendered
- **THEN** the weak knowledge point SHALL display as a clickable link navigating to the corresponding preparation workspace position

#### Scenario: Diagnosis does not auto-trigger teaching adjustments
- **WHEN** the teacher views the report
- **THEN** the system SHALL NOT automatically generate exercises, modify lesson plans, or bypass teacher review

## MODIFIED Requirements

### Requirement: Diagnosis views are role-specific (extension)
Modifies role-based-learning-diagnosis spec

#### Scenario: Teacher triggers diagnosis from teaching assistant
- **WHEN** an authorized teacher initiates diagnosis from the teaching assistant interface
- **THEN** the diagnosis SHALL be generated via the Konling TA diagnosis mode
- **AND** tools SHALL include get_student_risk_flags, get_class_competency_summary, get_student_knowledge_progress