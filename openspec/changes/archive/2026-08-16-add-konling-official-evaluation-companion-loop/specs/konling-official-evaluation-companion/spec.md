## ADDED Requirements

### Requirement: Companion evidence is limited to scoped official evaluation
The system SHALL construct control-workbench companion attempts only from persisted official Arena submissions for the authenticated student and current task. Each attempt SHALL retain the submission reference, official validity, controller artifact parameters, official metrics, and hard-constraint outcomes. Preview metrics, ordinary simulation runs, and client-supplied attempt values MUST NOT determine companion intervention or verification.

#### Scenario: Failed official submission starts an eligible attempt
- **WHEN** a student completes a persisted official Arena submission from a supported control workbench
- **THEN** the companion evaluates that submission with the student's prior submissions for the same task
- **AND** it uses the official validity, hard constraints, metrics, and controller artifact as evidence

#### Scenario: Unscoped history is unavailable
- **WHEN** a submission belongs to another student or another task
- **THEN** the companion MUST NOT use it as an attempt, baseline, or comparison source

### Requirement: Companion intervention preserves task-owned standards
The system SHALL use an unpassed current official hard constraint as the only source of a formal constraint-violation conclusion. It MUST NOT use generic overshoot, comfort, stability-margin, settling-time, or other fixed thresholds to determine whether a formal task constraint is violated.

#### Scenario: Task-specific hard constraint fails
- **WHEN** the current official evaluation contains one or more unpassed hard constraints
- **THEN** the companion identifies the student-visible hard-constraint labels and official reasons from that evaluation
- **AND** it does not substitute a generic threshold or recommendation as the task standard

### Requirement: Companion selects one task-scoped intervention reason
The system SHALL choose at most one companion intervention reason per official submission. It SHALL prioritize parameter-change stagnation over consecutive task failure, and consecutive task failure over current hard-constraint failure.

#### Scenario: Parameter changes do not resolve the same failed constraints
- **WHEN** three consecutive official submissions for one task change controller parameters and retain the same unpassed hard-constraint set
- **THEN** the companion creates a parameter-change stagnation intervention

#### Scenario: Two consecutive submissions fail
- **WHEN** the two latest official submissions for one task are invalid and the stagnation condition is not met
- **THEN** the companion creates a consecutive-failure intervention

#### Scenario: First failed official submission
- **WHEN** the current official submission has an unpassed hard constraint and no higher-priority reason applies
- **THEN** the companion creates a formal constraint-violation intervention

### Requirement: Companion rounds are verified by the next same-task official submission
The system SHALL associate each companion intervention with the official submission that triggered it. The next official submission by the same student for that task SHALL close the intervention round and compare only that result with the associated baseline.

#### Scenario: Follow-up official submission is available
- **WHEN** a student submits the same task after receiving a companion intervention
- **THEN** the companion reports changed official metric values and changed hard-constraint states against the intervention baseline
- **AND** it does not label a controller as best or infer overall superiority from a single metric delta

#### Scenario: Follow-up still needs intervention
- **WHEN** the follow-up submission closes a companion round and also meets an intervention condition
- **THEN** the completed round remains linked to its baseline
- **AND** the follow-up submission starts a new companion round

### Requirement: Companion advice remains advisory and verifiable
The companion SHALL render its advice inside the official result context with the evidence that supports it. It MUST NOT apply controller parameters, submit an artifact, change a task constraint, or change learning-path planning, generation, selection, ordering, or execution.

#### Scenario: Student receives a companion card
- **WHEN** an official submission creates a companion intervention
- **THEN** the result panel shows one expandable card with the official evidence, a next adjustment direction, and optional helpfulness feedback
- **AND** the student retains control over any parameter change and later submission
