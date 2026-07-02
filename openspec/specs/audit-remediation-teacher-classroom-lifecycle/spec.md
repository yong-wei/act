# audit-remediation-teacher-classroom-lifecycle Specification

## Purpose

Define the durable classroom lifecycle contract for class-bound and temporary launch identity, duplicate-session protection, live classroom presence/delivery state, lifecycle evidence fields, and ended-session handoff surfaces.
## Requirements

Requirements are merged from archived OpenSpec changes.

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

### Requirement: Classroom lifecycle actions shall use product states
Classroom launch, reuse, join, projection, finalization, deletion, and review-entry actions SHALL use product-owned lifecycle states and recovery paths.

#### Scenario: an active classroom already exists
- **WHEN** a teacher launches a class-bound or temporary classroom and an active compatible session exists
- **THEN** the UI SHALL offer reuse, create-new, and cancel choices with explicit class/session identity and no native confirm dependency.

#### Scenario: a student joins with an invalid or unavailable classroom code
- **WHEN** a classroom code is malformed, not found, expired, closed, full, or unauthorized
- **THEN** the UI and API SHALL expose the same recovery category and next action.

#### Scenario: a classroom is ended or deleted
- **WHEN** a teacher ends an active classroom or deletes an ended classroom
- **THEN** the UI SHALL show impact preview, product confirmation, execution status, and post-action recovery.
- **AND** students and direct teacher links SHALL render the correct ended or unavailable state.

### Requirement: Classroom runtime variants shall share lifecycle semantics
Class-bound, temporary, demo, and real session runtime variants SHALL share launch, projection, end, and recovery semantics where the action is lifecycle-owned.

#### Scenario: a teacher opens projection or runtime direct links
- **WHEN** a teacher opens a waiting, projection, runtime, or ended direct link
- **THEN** the page SHALL recover the session state or show a product recovery state without normal live-state misrepresentation.

### Requirement: Classroom lifecycle audit closure shall be evidence backed
Classroom lifecycle findings SHALL be closed only with linked implementation evidence.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference tests, UI evidence, and residual scope.

