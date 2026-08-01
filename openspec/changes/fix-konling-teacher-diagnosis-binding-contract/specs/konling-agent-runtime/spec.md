## ADDED Requirements

### Requirement: Teacher diagnosis session binding excludes client scope
The system SHALL persist the `teacher-diagnosis` assistant-mode identity without persisting browser-provided teacher, class, student, or other context hints. Each diagnosis tool invocation SHALL continue to establish its authorization scope from server-owned data.

#### Scenario: Teacher diagnosis conversation is created from browser hints
- **WHEN** a browser creates a `teacher-diagnosis` conversation with arbitrary client context hints
- **THEN** the persisted assistant binding SHALL retain `teacher-diagnosis` with an empty hint object
- **AND** the client hints SHALL NOT determine diagnostic authorization scope.
