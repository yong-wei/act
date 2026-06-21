## ADDED Requirements

### Requirement: AI surfaces must not expose internal context to students
The system SHALL sanitize server context, raw evidence diagnostics, provider details, and citation validation internals before AI output is shown to student users.

#### Scenario: Student Copilot evidence answer is sanitized
- **WHEN** Copilot answers from evidence context for a student
- **THEN** the response does not expose raw diagnostic JSON or hidden validation metadata

### Requirement: AI tasks must produce scoped outputs
The system SHALL map audited AI and Prompt actions to explicit task outputs such as practice tasks, feedback writeback, prompt evaluation results, or portfolio drafts.

#### Scenario: Report feedback AI creates practice task candidates
- **WHEN** AI is invoked for report feedback remediation
- **THEN** the UI shows scoped practice task candidates and an adopt/discard/writeback path

#### Scenario: Portfolio reflection creates draft
- **WHEN** a student uses Copilot or portfolio reflection create intent
- **THEN** the system creates or displays a draft/candidate object rather than returning to a generic AI page

### Requirement: AI focus and status must respect page tasks
The system SHALL ensure Global AI, page-local AI, Prompt inputs, stop/retry/clear actions, and citation states do not steal focus or hide primary task status.

#### Scenario: Prompt input is not stolen by Global AI
- **WHEN** a Prompt evaluation page is active
- **THEN** the primary prompt input receives task input and Global AI does not intercept it

### Requirement: AI remediation must update audit findings
The system SHALL mark AI audit findings fixed only after sanitization, focus, status, and durable-output evidence exists.

#### Scenario: AI finding is closed
- **WHEN** an AI finding is remediated
- **THEN** the audit report cites the original chapter and new evidence for sanitized output or durable task state
