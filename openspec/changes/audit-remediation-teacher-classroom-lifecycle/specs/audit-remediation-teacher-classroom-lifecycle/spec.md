## ADDED Requirements

### Requirement: Classroom launch shall preserve class or temporary-session identity
Teacher launch flows SHALL require and display whether a classroom is class-bound or temporary, and SHALL prevent accidental duplicate active sessions.

#### Scenario: Class-bound launch
- **WHEN** a teacher starts a lesson from a class context
- **THEN** the launch UI, projection header, QR/code dialog, student runtime, and session summary SHALL display the class identity
- **AND** duplicate active sessions for the same teacher, lesson, and class SHALL require explicit reuse or new-session confirmation.

#### Scenario: Temporary launch
- **WHEN** a teacher starts a temporary classroom
- **THEN** the UI SHALL label it as temporary
- **AND** students SHALL not see raw session ids as the primary classroom identity.

### Requirement: Live classroom state shall expose presence, delivery, and finalization
Teacher and student runtime surfaces SHALL expose release, delivery, presence, submission, and ended/review states with product language.

#### Scenario: Released task
- **WHEN** a teacher releases an interaction
- **THEN** the teacher view SHALL show delivery and non-submitted states
- **AND** the student view SHALL show released and submitted status without teacher-only aggregates.
- **AND** the evidence event SHALL include stable event type, actor role, session id, step/card id where applicable, `clientEventId`, `sourceLogId` when available, `clientEventAt`, and deduplication identity.

#### Scenario: Ended classroom
- **WHEN** a classroom ends
- **THEN** teacher and student direct links SHALL render ended or review states
- **AND** live projection controls SHALL not remain the primary surface.

#### Scenario: Classroom controls and status
- **WHEN** a teacher copies a classroom code, starts class, changes page, releases an interaction, opens the online-student panel, or ends class
- **THEN** the control SHALL have a stable accessible name
- **AND** the result SHALL be announced through `role=status` or `aria-live`
- **AND** heartbeat or freshness display SHALL state when roster or delivery state was last observed.
