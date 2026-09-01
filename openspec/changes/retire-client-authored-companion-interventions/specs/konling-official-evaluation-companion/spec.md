## MODIFIED Requirements

### Requirement: Companion evidence is limited to scoped official evaluation
The system SHALL construct control-workbench companion attempts only from persisted official Arena submissions for the authenticated student and current task. Each attempt SHALL retain the submission reference, official validity, controller artifact parameters, official metrics, and hard-constraint outcomes. Preview metrics, ordinary simulation runs, client-supplied attempt values, and legacy interventions without a verified official submission reference MUST NOT determine companion intervention, cooldown, baseline or verification.

#### Scenario: Failed official submission starts an eligible attempt
- **WHEN** a student completes a persisted official Arena submission from a supported control workbench
- **THEN** the companion SHALL evaluate that submission with the student's prior official submissions for the same task
- **AND** it SHALL use the official validity, hard constraints, metrics and controller artifact as evidence.

#### Scenario: Client supplies a hand-entered attempt
- **WHEN** a request contains client-authored parameters, metrics, success state or attempt history without a verified official submission reference
- **THEN** the system SHALL NOT create a control-workbench companion intervention, evidence record, Memory or verification baseline
- **AND** it SHALL NOT treat the supplied values as official or governed learning evidence.

#### Scenario: Legacy intervention lacks official submission evidence
- **WHEN** a historical intervention has no verifiable scoped official submission reference
- **THEN** it MAY remain visible to authorized audit tooling
- **AND** it SHALL be excluded from official companion rounds and follow-up comparisons.

### Requirement: Companion advice remains advisory and verifiable
The companion SHALL render its advice only inside the official result context with the official evidence that supports it. The production control workbench MUST NOT expose a parallel client-authored attempt form that creates governed companion interventions. The companion MUST NOT apply controller parameters, submit an artifact, change a task constraint, or change learning-path planning, generation, selection, ordering or execution.

#### Scenario: Student receives a companion card
- **WHEN** an official submission creates a companion intervention
- **THEN** the result panel SHALL show one expandable card with the official evidence, a next adjustment direction and optional helpfulness feedback
- **AND** the student SHALL retain control over any parameter change and later submission.

#### Scenario: Student has not made an official submission
- **WHEN** the student only edits parameters, runs a preview or records a local observation
- **THEN** the production workbench SHALL NOT create a governed companion card or persisted intervention from those values
- **AND** official submission controls SHALL remain available according to the existing task contract.
