## ADDED Requirements

### Requirement: Arena exposes all supported leaderboard views
The system SHALL let students inspect supported leaderboard types for a challenge when the task policy enables them.

#### Scenario: Challenge has multiple leaderboard types
- **WHEN** the student opens the leaderboard browser
- **THEN** main, method, metric, Pareto, class, and season views are available according to task policy and context

### Requirement: Arena derives honors from official submissions
The system SHALL award or display honors only from official Arena evaluation evidence.

#### Scenario: Submission qualifies for an honor
- **WHEN** a valid official submission satisfies a configured honor criterion
- **THEN** the honor is displayed with the evidence that justified it

### Requirement: Showcase summaries preserve privacy
The system SHALL avoid exposing private controller details in excellent-solution showcases unless a publication policy allows it.

#### Scenario: Excellent solution is shown
- **WHEN** a solution appears in the showcase
- **THEN** the default view shows score, method, metrics, and explanation summary, not raw private payload
