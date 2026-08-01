## ADDED Requirements

### Requirement: Konling diagnoses authenticated adaptive attempts
Konling SHALL explain an adaptive attempt only from server-owned snapshots within the authenticated student's persisted assessment session.

#### Scenario: Student requests diagnosis for an owned answer
- **WHEN** an authenticated student opens diagnosis with a durable answer id
- **THEN** the runtime SHALL verify answer ownership and session ownership
- **AND** it SHALL load the current snapshot and at most three most recent attempts from the same student and session
- **AND** each recent attempt SHALL carry controlled misconception tags for repeated-misconception detection.

#### Scenario: Attempt context cannot be verified
- **WHEN** the answer belongs to another user or session, or any required snapshot is missing or inconsistent
- **THEN** the runtime SHALL fail closed with an explicit unavailable response
- **AND** it SHALL NOT enter a generic model response using client-provided facts.

#### Scenario: Reviewed remediation is presented
- **WHEN** the verified snapshot contains governed remediation resources
- **THEN** the prompt SHALL expose their persisted canonical titles and targets
- **AND** it SHALL NOT invent resource links.

### Requirement: Konling conversation context is isolated
Each Konling conversation SHALL retain its own teaching-assistant mode and controlled server-context binding.

#### Scenario: Student switches between diagnosis and path advising
- **WHEN** the student creates a dedicated attempt-diagnosis conversation and later selects an existing path-advisor or generic conversation
- **THEN** subsequent messages SHALL use the selected conversation's persisted mode and server-context hints
- **AND** the diagnosis answer id SHALL NOT leak into another conversation.
