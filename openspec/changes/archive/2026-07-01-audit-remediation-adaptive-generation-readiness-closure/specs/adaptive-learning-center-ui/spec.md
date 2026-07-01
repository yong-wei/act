## ADDED Requirements

### Requirement: Adaptive path generation shall explain readiness blockers
Adaptive path generation SHALL expose actionable readiness states when learner data, class binding, teacher binding, advisor permission, or services prevent generation.

#### Scenario: generation preconditions are missing
- **WHEN** a student opens path generation and class binding, teacher binding, learner state, advisor context, or evidence prerequisites are missing
- **THEN** the UI SHALL show the specific safe blocker category, a student-facing next action, and a staff-facing remediation path when applicable.
- **AND** it SHALL NOT display a normal path-generation action that can only fail with a generic retry message.

#### Scenario: generation dependency service fails
- **WHEN** learner-state, advisor-context, or planner support services return unavailable, forbidden, or retryable errors
- **THEN** the generation surface SHALL distinguish unavailable, forbidden, and retryable states.
- **AND** available citations, evidence summaries, or fallback learning suggestions SHALL remain visible at reduced personalization confidence.

### Requirement: Adaptive generation audit closure shall avoid archived path-execution scope
Adaptive generation readiness findings SHALL be closed only for precondition and service-error behavior, not for already archived path execution and recovery scope.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference readiness tests or UI evidence and SHALL explicitly avoid re-closing findings covered by `audit-remediation-student-path-evidence-loop-closure`.
