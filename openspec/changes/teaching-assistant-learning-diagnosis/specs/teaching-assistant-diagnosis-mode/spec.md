## ADDED Requirements

### Requirement: Teaching assistant triggers learning diagnosis
The system SHALL support teacher-initiated learning diagnosis generation through the Konling teaching assistant runtime.

#### Scenario: Teacher requests class diagnosis
- GIVEN an authorized teacher is in the teaching assistant interface
- AND the teacher has class scope authorization
- WHEN the teacher clicks Generate Diagnosis
- THEN the system SHALL initiate a Konling TA diagnosis mode session
- AND the session SHALL invoke get_student_risk_flags, get_class_competency_summary, and get_student_knowledge_progress tools
- AND the model SHALL produce a structured diagnosis report from the tool results
- AND all tools SHALL validate that requested userId/classId falls within the teacher authorized scope

#### Scenario: Risk flags prompt diagnosis awareness
- GIVEN risk flags have been produced by the background scanner
- WHEN a teacher opens the teaching assistant dashboard
- THEN the dashboard SHALL display risk flag indicators per-class and per-student

### Requirement: Background risk scanner
The system SHALL run a deterministic background scan for student risk flags.

#### Scenario: Risk scanner respects deterministic rules only
- WHEN no deterministic rule condition is met
- THEN the scanner SHALL NOT create speculative or AI-generated risk flags

### Requirement: Diagnosis report persistence
The system SHALL persist diagnosis reports as structured JSON for historical comparison.

### Requirement: Diagnosis-to-action linking
Diagnosis reports SHALL provide navigation links to the preparation workspace without triggering automatic teaching actions.

## MODIFIED Requirements

### Requirement: Diagnosis views are role-specific (extension)
Modifies role-based-learning-diagnosis spec

#### Scenario: Teacher triggers diagnosis from teaching assistant
- WHEN an authorized teacher initiates diagnosis from the teaching assistant interface
- THEN the diagnosis SHALL be generated via the Konling TA diagnosis mode
- AND tools SHALL include get_student_risk_flags, get_class_competency_summary, get_student_knowledge_progress
- AND tool results SHALL be scoped to the teacher authorized class membership