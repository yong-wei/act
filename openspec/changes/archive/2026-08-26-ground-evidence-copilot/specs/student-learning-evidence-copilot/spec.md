## ADDED Requirements

### Requirement: Evidence Copilot uses server-authorized evidence

Evidence Copilot SHALL build factual context from governed learning evidence authorized for the authenticated student.

#### Scenario: Evidence context is requested

- **WHEN** an authenticated student opens `/ai/copilot?context=evidence` and sends a message
- **THEN** the server SHALL resolve the student's governed evidence using the authenticated identity
- **AND** only the resulting student-safe projection SHALL be available as factual model context
- **AND** the response metadata SHALL preserve evidence status and limitations.

#### Scenario: Client changes the source hint

- **WHEN** the request changes `source`, `assignment`, or `intent` to describe another task or unsupported evidence
- **THEN** the server SHALL treat those values only as bounded navigation hints
- **AND** they SHALL NOT create, substitute, or expand student evidence facts or authorization scope.

### Requirement: Evidence availability is truthful

Evidence Copilot SHALL distinguish known zero values from missing, partial, stale, and unavailable evidence.

#### Scenario: No governed evidence exists

- **WHEN** the evidence projection is empty or missing
- **THEN** the assistant SHALL state that evidence is not available
- **AND** it SHALL avoid personal scores, diagnoses, and fabricated counts
- **AND** the page SHALL offer a reachable evidence-gathering or practice action.

#### Scenario: Evidence is partial or stale

- **WHEN** only some eligible sources are available or the evidence is stale/low-confidence
- **THEN** the assistant SHALL identify the limitation in student-facing language
- **AND** any advice SHALL be framed as provisional and tied to the available evidence.

### Requirement: Evidence Copilot remains advisory

Evidence Copilot SHALL not automatically write model output to official learning records.

#### Scenario: The assistant suggests a next step

- **WHEN** the assistant proposes a practice, review, or reflection action
- **THEN** it SHALL return an advisory candidate or navigation action
- **AND** it SHALL not mutate official scores, leaderboards, `LearningFact`, or learner-profile claims without a separate explicit-save contract.

### Requirement: General Copilot compatibility is preserved

Requests without Evidence Copilot context SHALL retain their existing page-context, conversation, tool, and authorization behavior.

#### Scenario: Ordinary chat is requested

- **WHEN** `/api/ai/chat` receives a normal Copilot request without Evidence Copilot context
- **THEN** the route SHALL not require an evidence projection
- **AND** existing authenticated runtime behavior SHALL remain unchanged.
