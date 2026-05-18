## Purpose
Define consistency requirements between Arena workbench submissions, official evaluation, hard constraints, and leaderboards.
## Requirements
### Requirement: Official submission occurs only through workbench surfaces
The system SHALL route supported Arena official submissions through workbench submit panels and SHALL persist successful official evaluations into leaderboard data.

#### Scenario: Workbench submit persists official result
- **WHEN** a student submits from the challenge-bound workbench
- **THEN** the workbench SHALL call `/api/arena/evaluate`
- **AND** a valid official evaluation SHALL be persisted as an Arena submission
- **AND** the submission SHALL become eligible for main, method, and metric leaderboards.

#### Scenario: Challenge detail cannot submit
- **WHEN** a student opens a challenge detail page
- **THEN** no official submission request SHALL be possible from that page.

### Requirement: Official hard constraints use correct controller transfer functions
White-box official hard-constraint checks SHALL construct controller transfer functions according to the effective controller structure and parameters.

#### Scenario: PD controller has no integrator pole
- **WHEN** a PID-family artifact has `ki = 0` and `kd > 0`
- **THEN** official evaluation SHALL treat it as a PD controller without an integrator denominator
- **AND** closed-loop stability SHALL be checked against the correct characteristic polynomial.

#### Scenario: PI and PID controllers retain integrator pole
- **WHEN** a PID-family artifact has `ki > 0`
- **THEN** official evaluation SHALL include the integrator denominator in the controller transfer function
- **AND** closed-loop stability SHALL be checked against the resulting characteristic polynomial.

#### Scenario: Reported PD regression passes stability gate
- **WHEN** the task is `task-second-order-lead-pid` and the submitted PID-family artifact has `kp = 250.583`, `ki = 0`, and `kd = 29.128`
- **THEN** official evaluation SHALL pass the `closed_loop_stable` hard constraint if the computed closed-loop poles are stable.

### Requirement: Workbench preview and official evaluation use consistent parameter semantics
The workbench preview, controller artifact mapper, and official evaluator SHALL use the same effective controller parameter semantics.

#### Scenario: PID artifact mapper preserves effective parameters
- **WHEN** the workbench builds a PID-family official artifact from correction state and gain
- **THEN** the artifact SHALL contain the same effective `kp`, `ki`, and `kd` values used by the control-analysis request.

#### Scenario: Serial compensator mapper preserves gain and zero-pole values
- **WHEN** the workbench builds a lead or lag serial-compensator artifact
- **THEN** the artifact SHALL contain the same controller gain, zero frequency, and pole frequency used by the workbench chart calculations.

### Requirement: Official evaluation explanations and hard constraints are Chinese
Official evaluation results shown to students SHALL use Chinese hard-constraint labels, Chinese explanations, and metric comparison rows that place target or threshold values next to actual values.

#### Scenario: Failed hard constraint is readable
- **WHEN** an official submission fails a hard constraint
- **THEN** the workbench SHALL show a Chinese hard-constraint label and Chinese reason
- **AND** raw ids such as `finite_response` SHALL NOT be the student-facing label.

#### Scenario: Official metrics compare target and actual values
- **WHEN** an official submission returns ranking metrics or hard-threshold metrics
- **THEN** the official submission module SHALL show Chinese metric labels, target or threshold values, actual values, and status for each displayed metric
- **AND** status color SHALL indicate whether the metric reached the target, is near the target, or failed the target.

#### Scenario: Valid zero score is explained
- **WHEN** an official submission passes hard constraints but receives final score `0`
- **THEN** the official submission module SHALL state in Chinese that the hard constraints passed
- **AND** it SHALL explain that the zero score comes from ranking metric satisfaction or scoring aggregation, not from a failed official submission.

#### Scenario: Raw English evaluator notes are hidden
- **WHEN** official evaluation includes provider or evaluator notes in English
- **THEN** those raw English notes SHALL NOT be shown directly to students
- **AND** any displayed explanation SHALL be Chinese.

### Requirement: Leaderboards include only valid official submissions
Arena leaderboards SHALL include only official submissions that pass hard constraints.

#### Scenario: Invalid submission is excluded
- **WHEN** an official submission fails any hard constraint
- **THEN** it SHALL receive zero score or invalid status according to the metric profile evaluator
- **AND** it SHALL NOT appear in official leaderboard rankings.

### Requirement: Student official evaluation failure is browser-reproduced and repaired
The system SHALL support successful official evaluation from a student-authenticated workbench session for supported Arena challenges.

#### Scenario: Student account can reproduce the submit flow
- **WHEN** an implementer validates this change
- **THEN** they SHALL log in with a student account and submit through the Arena-bound workbench in a browser
- **AND** they SHALL capture enough request, response, console, or server evidence to identify the source of any failure.

#### Scenario: Valid official submission does not show generic failure
- **WHEN** a student submits a valid supported controller artifact from the Arena-bound workbench
- **THEN** the UI SHALL NOT show the generic message `Arena evaluation failed`
- **AND** the official evaluation response SHALL either persist a valid Arena submission or show a specific Chinese validation reason.

#### Scenario: Successful student evaluation appears in official data
- **WHEN** the official evaluation accepts a student submission
- **THEN** the submission SHALL be persisted through the Arena official submission path
- **AND** the result SHALL be eligible for the leaderboard rules defined by the task's metric profile.

