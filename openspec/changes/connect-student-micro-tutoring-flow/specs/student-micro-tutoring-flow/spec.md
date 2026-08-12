## Purpose

让学生在自适应练习的受治理错题反馈中自主完成一次可追溯、可验证且不改变正式学习状态的微辅导闭环。

## ADDED Requirements

### Requirement: Wrong-answer feedback offers an explicit micro-tutoring entry
The system SHALL show a micro-tutoring entry only for an authenticated student's persisted incorrect adaptive-assessment answer. Creating an orchestration result or intervention SHALL require an explicit student action and SHALL NOT occur on answer submission, page load, or opening the existing explanation assistant.

#### Scenario: Student starts tutoring from a persisted wrong answer
- **WHEN** an authenticated student explicitly selects micro tutoring from their persisted incorrect answer feedback
- **THEN** the system SHALL derive or retrieve the student's owned attribution server-side and return a learner-safe available or unavailable orchestration result
- **AND** the browser SHALL NOT receive or submit an internal attribution identifier

#### Scenario: Answer is not eligible for attribution
- **WHEN** the persisted answer has no current governed attribution or is not owned by the authenticated student
- **THEN** the system SHALL show a controlled unavailable state without disclosing another learner's evidence or task

#### Scenario: Legacy or unreviewed question has no entry
- **WHEN** an incorrect adaptive-practice answer does not carry a reviewed catalog reference
- **THEN** the system SHALL NOT show the micro-tutoring entry
- **AND** it SHALL preserve the existing wrong-answer feedback and explanation controls

### Requirement: Student can execute the available task through explicit events
The system SHALL present an available micro-tutoring task in the adaptive-practice experience with its learning goal, governed resource actions, estimated duration, current progress and explicit controls for start, resource use, hint request and completion. Each mutating action SHALL use a stable client event key so retrying the same interaction is idempotent.

#### Scenario: Student completes resource learning
- **WHEN** a student starts an available task and explicitly opens a governed resource or requests a hint
- **THEN** the system SHALL record the corresponding event against that student's intervention instance
- **AND** it SHALL preserve the intervention state when the browser retries the same action

#### Scenario: Task becomes unavailable during execution
- **WHEN** current authorization or a version check invalidates the task after the student starts it
- **THEN** the system SHALL show a controlled unavailable state and SHALL NOT expose stale resource or validation details

#### Scenario: Student explicitly regenerates after reference drift
- **WHEN** an available task becomes unavailable with `REFERENCE_DRIFT`
- **THEN** the system SHALL hide stale task details and offer an explicit fresh orchestration action
- **AND** a successful fresh orchestration SHALL restore the current task's start action
- **AND** the server SHALL derive ownership from the durable answer and use a stable refresh identity to create or return the same refreshed orchestration
- **AND** it SHALL create a refreshed orchestration only when the initial owned result currently projects as `REFERENCE_DRIFT`
- **AND** the browser SHALL NOT automatically retry the stale request

### Requirement: Student receives a safe validation question and recommendation
The system SHALL provide the selected validation question only after the student's intervention has started and remains authorized. The student-visible question SHALL contain only the prompt and selectable options required to answer it; it SHALL NOT contain an answer key, explanation, original-question identity, attribution details or internal knowledge identifiers. After submission, the system SHALL show the server-derived result and next-step recommendation without mutating mastery or the formal learning path.

#### Scenario: Student submits validation after completing tutoring
- **WHEN** a student submits one option for their current available validation question
- **THEN** the system SHALL evaluate it server-side and show the learner-safe validation result and recommendation
- **AND** it SHALL NOT update mastery, learning facts or the formal learning path

#### Scenario: Validation question is unavailable
- **WHEN** the question cannot be read because the intervention has not started, access is revoked, or its governed version has drifted
- **THEN** the system SHALL not return question content and SHALL show a recoverable unavailable state

### Requirement: Student flow communicates failure and recovery states
The system SHALL distinguish unavailable, authorization, network, duplicate-action and terminal-validation states in the student experience. A transient request failure SHALL retain safe local progress and offer a retry; a rejected or stale request SHALL not be retried automatically.

#### Scenario: Network request fails before an event is accepted
- **WHEN** a client request fails without a confirmed server result
- **THEN** the system SHALL retain the pending action context and offer the student an explicit retry using the same event identity

#### Scenario: Validation has already been recorded
- **WHEN** the student repeats a validation submission after a terminal result exists
- **THEN** the system SHALL show the recorded result rather than suggesting another answer can be submitted
