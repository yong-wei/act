## ADDED Requirements

### Requirement: Konling conversations belong to the authenticated user
Readable Konling conversations SHALL be owned by one authenticated user and SHALL remain available across supported pages until the user deletes them or existing global retention governance removes them.

#### Scenario: Owner lists conversations
- **WHEN** an authenticated user opens the Konling conversation library
- **THEN** the system SHALL return only that user's readable conversations ordered by pinned state and recent activity.

#### Scenario: Another user requests a conversation
- **WHEN** a user requests a conversation owned by another user without an authorized governance role
- **THEN** the system SHALL deny access to its title, messages, context records, and tool runs.

#### Scenario: Conversation produces a structured task action
- **WHEN** a conversation proposes or applies a smart-preparation task change
- **THEN** the proposal, tool run, and applied artifact SHALL retain exact task and task-revision lineage
- **AND** user-level conversation ownership SHALL NOT replace domain artifact ownership or revision binding.

### Requirement: Conversation library supports deliberate organization
The library SHALL support new conversation, title search, manual rename, pin or unpin, and confirmed deletion.

#### Scenario: First exchange completes
- **WHEN** the first complete user question and assistant answer are persisted and the title has not been manually edited
- **THEN** the system SHALL assign an automatic title derived from the exchange
- **AND** it SHALL fall back to a bounded form of the first user prompt when naming cannot complete.

#### Scenario: Manually named conversation receives later messages
- **WHEN** a user has renamed a conversation
- **THEN** automatic naming SHALL NOT overwrite the manual title.

#### Scenario: User searches titles
- **WHEN** the user enters a search term
- **THEN** the library SHALL filter by conversation title
- **AND** full message-content search SHALL NOT be required.

#### Scenario: Current conversation is deleted
- **WHEN** the user confirms deletion of the active conversation
- **THEN** the conversation and its owned message and tool-run records SHALL be removed according to retention rules
- **AND** the UI SHALL open a new blank conversation while independently persisted platform artifacts remain.

### Requirement: Cross-page continuation appends context without rewriting history
The runtime SHALL preserve the initiating page context and SHALL append one server-authored current-page context record immediately before a new user message when the conversation continues from a materially different page context.

#### Scenario: Conversation continues on the same page context
- **WHEN** the current authorized page-context identity matches the latest recorded context
- **THEN** the runtime SHALL append only the new user message
- **AND** it SHALL NOT duplicate the page-context record.

#### Scenario: Conversation continues on another page
- **WHEN** the current authorized page-context identity differs from the latest recorded context
- **THEN** the runtime SHALL append the new current-page context record and then the user message in that order
- **AND** it SHALL NOT rewrite the system prefix, initiating context, prior context records, or prior messages.

#### Scenario: Client supplies unauthorized context
- **WHEN** client hints contain data outside the user's current authorized page scope
- **THEN** the server SHALL omit or reject those fields before persisting the context record.

### Requirement: Existing usable conversations migrate into the library
The system SHALL migrate existing readable Konling sessions idempotently while preserving chronological messages, readable tool records, and original timestamps.

#### Scenario: Existing session has usable history
- **WHEN** a session contains at least one readable exchange or meaningful tool record and is not expired
- **THEN** it SHALL appear as one owner-scoped library conversation with an automatic title when needed.

#### Scenario: Existing session is not usable
- **WHEN** a session is expired, empty, or contains only failed initialization
- **THEN** it SHALL be excluded from the conversation library migration.

#### Scenario: Migration runs again
- **WHEN** the migration is rerun
- **THEN** it SHALL reuse prior migration identity
- **AND** it SHALL NOT duplicate conversations, messages, or tool runs.
