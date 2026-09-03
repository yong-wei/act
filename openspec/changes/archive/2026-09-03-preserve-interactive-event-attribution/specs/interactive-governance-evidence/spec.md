## ADDED Requirements

### Requirement: Interactive events attribute only to the identity that produced them

The interactive tracking queue SHALL attribute events only to the identity context that was confirmed when the events were produced. When the identity key of the tracking queue changes (guest to logged-in student, or one student to another), the client SHALL reset the in-memory queue to the stored state of the new identity key — clearing the queue when the new key has no stored events — and SHALL NOT submit the previous identity's pending events under the new session. Guest events SHALL remain local pending state and SHALL NOT be promoted to logged-in student evidence by a later login. The server SHALL remain the sole attribution authority: unauthenticated event writes SHALL be rejected, and persisted ownership SHALL be derived exclusively from the authenticated session, ignoring client-supplied identity fields.

#### Scenario: Guest events are not attributed to the student who logs in

- **WHEN** a guest produces interactive events on an independent resource and the same page then logs in as a student whose identity key has no stored events
- **THEN** the client queue SHALL reset to empty and the guest events SHALL NOT be submitted under the student's session.

#### Scenario: Switching between two students does not cross-attribute

- **WHEN** student A's pending events exist in the queue and the identity switches to student B
- **THEN** student A's events SHALL remain under student A's storage key only and student B's session SHALL only submit events produced or stored under student B's identity key.

#### Scenario: Same identity keeps its recovery behavior

- **WHEN** the page refreshes or a sync fails transiently for the same identity
- **THEN** pending events under that identity's storage key SHALL still be restored and retried.

#### Scenario: Server rejects unauthenticated writes and owns attribution

- **WHEN** an event batch is posted without an authenticated session, or with client-supplied identity fields that differ from the session
- **THEN** the unauthenticated batch SHALL be rejected with 401
- **AND** the authenticated batch SHALL be persisted under the authenticated session user only.
