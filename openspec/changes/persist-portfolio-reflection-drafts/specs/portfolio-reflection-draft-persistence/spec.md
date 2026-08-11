## ADDED Requirements

### Requirement: Students can explicitly save and reopen portfolio reflection drafts
The system SHALL persist a displayed portfolio reflection candidate only after the authenticated student explicitly saves it. Each active draft SHALL retain its source, optional assignment, intent, title, editable content, candidate lifecycle state, timestamps, and user-scoped idempotency identity.

#### Scenario: Saved draft survives a new page load
- **WHEN** a student saves a valid portfolio reflection candidate and later refreshes or returns to the reflection page
- **THEN** the active draft is returned from persistent storage and can be reopened for continued editing

#### Scenario: Repeated candidate submission is idempotent
- **WHEN** the same student submits the same candidate request identity more than once
- **THEN** the system retains one active draft rather than creating duplicate draft rows

### Requirement: Portfolio reflection draft access is learner-scoped
The system SHALL derive draft ownership from the authenticated session and SHALL not expose, update, or discard another student's drafts.

#### Scenario: A student requests another draft id
- **WHEN** a student attempts to update or discard a draft not owned by that student
- **THEN** the system returns a not-found result and leaves the other student's draft unchanged

### Requirement: Draft lifecycle does not promote learning evidence
Saving, editing, listing, and discarding a portfolio reflection draft SHALL not create `LearningFact`, update a learner portrait, change an official score, or publish a formal portfolio artifact.

#### Scenario: Student discards a saved draft
- **WHEN** a student discards an active portfolio reflection draft
- **THEN** the draft becomes discarded, disappears from that student's active list, and no formal learning-state writeback occurs
