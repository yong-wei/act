# arena-student-diagnostic-feedback Specification

## Purpose
Define reusable student-facing Arena diagnostic feedback rules for official submissions, personal-best comparison, hard-constraint failures, and black-box secrecy boundaries.

## Requirements

### Requirement: Student feedback explains official Arena submission outcomes
The system SHALL generate student-facing diagnostic feedback from official Arena submission results.

#### Scenario: Ranked official submission
- **WHEN** an official submission is valid and eligible for ranking
- **THEN** the feedback MUST state that the submission entered official ranking
- **AND** it MUST summarize score, strongest metric, weakest metric, and next-step suggestion in Chinese

#### Scenario: Hard constraint failure
- **WHEN** an official submission fails one or more hard constraints
- **THEN** the feedback MUST state that the submission did not enter official ranking
- **AND** it MUST list Chinese hard-constraint failure reasons and a repair suggestion

### Requirement: Student feedback compares with personal best
The system SHALL compare a student's latest official submission with that student's previous best result for the same task when available.

#### Scenario: Improvement over personal best
- **WHEN** a latest submission exceeds the student's previous best score for the same task
- **THEN** the feedback MUST identify the improvement amount
- **AND** it MUST still show the weakest remaining metric if one exists

#### Scenario: Regression from personal best
- **WHEN** a latest submission scores below the student's previous best score for the same task
- **THEN** the feedback MUST identify the regression
- **AND** it MUST suggest returning to the metric or hard constraint that changed most

### Requirement: Feedback rules are reusable by current and future submission panels
Student diagnostic feedback SHALL be produced by shared Arena feedback rules rather than duplicated inside individual UI panels.

#### Scenario: White-box submission panel feedback
- **WHEN** the white-box Arena submission panel receives an official submission response
- **THEN** it MUST render feedback produced by the shared Arena feedback rules

#### Scenario: Unified workbench submission panel feedback
- **WHEN** the future unified control workbench submits an official Arena artifact
- **THEN** it MUST be able to call the same feedback rule module without reimplementing metric interpretation

### Requirement: Black-box feedback preserves hidden scenario secrecy
Student feedback for black-box official evaluation SHALL explain aggregate weaknesses without revealing hidden scenario details.

#### Scenario: Black-box aggregate feedback
- **WHEN** a black-box official submission has weak tracking, energy, smoothness, or safety metrics
- **THEN** the feedback MUST name the aggregate issue
- **AND** it MUST NOT expose hidden scenario parameters, scenario order, or trace data
