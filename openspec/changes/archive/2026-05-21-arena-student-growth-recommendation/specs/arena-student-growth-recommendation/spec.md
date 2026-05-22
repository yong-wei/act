## ADDED Requirements

### Requirement: Student profile summarizes Arena growth by capability
The system SHALL aggregate official Arena submission history into capability-level growth signals.

#### Scenario: Student has Arena submissions
- **WHEN** the profile API builds Arena portfolio data
- **THEN** it includes capability coverage, weak areas, and improvement signals derived from official submissions

### Requirement: Student profile recommends next Arena challenges
The system SHALL recommend Arena challenges from training metadata and the student's history.

#### Scenario: Student has weak metrics or missing prerequisites
- **WHEN** recommendations are generated
- **THEN** each recommended challenge includes a reason tied to capability gaps, weak metrics, or next training stage

### Requirement: Arena recommendations avoid fabricated evidence
The system SHALL not infer Arena capability from unavailable or unofficial submission evidence.

#### Scenario: Student has no official submissions
- **WHEN** the profile API builds Arena growth data
- **THEN** it returns beginner-safe recommendations and states that evidence is not yet available
