## MODIFIED Requirements

### Requirement: Konling conversations belong to the authenticated user
Readable Konling conversations SHALL be owned by one authenticated user and SHALL remain available across supported pages until the user deletes them or explicit global retention governance removes or expires them. A library conversation SHALL NOT become unreadable solely because a fixed product-level seven-day interval elapsed. Every list, read, update, delete and message operation SHALL enforce the same owner and governed-retention eligibility.

#### Scenario: Owner lists an older conversation
- **WHEN** an authenticated user opens the Konling conversation library and an owned visible conversation is older than seven days without a governed expiry
- **THEN** the system SHALL return that conversation according to pinned state and recent activity
- **AND** the user SHALL be able to open and continue it.

#### Scenario: Global governance has not scheduled expiry
- **WHEN** a new user conversation enters the readable library
- **THEN** it SHALL have no product-level fixed expiry
- **AND** the absence of a scheduled governance expiry SHALL be represented separately from an expired record.

#### Scenario: Explicit governed expiry has elapsed
- **WHEN** global retention governance has assigned an expiry and that time has elapsed
- **THEN** the conversation SHALL be excluded or removed according to that governance policy
- **AND** the client SHALL NOT treat the result as an empty new conversation with successful recovery.

#### Scenario: Another user requests a conversation
- **WHEN** a user requests a conversation owned by another user without an authorized governance role
- **THEN** the system SHALL deny access to its title, messages, context records and tool runs.

### Requirement: Existing usable conversations migrate into the library
The system SHALL migrate and retain existing readable Konling sessions idempotently while preserving chronological messages, readable tool records and original timestamps. Existing rows already marked `libraryVisible=true` but hidden only by the obsolete fixed seven-day expiry SHALL be restored without creating duplicate conversations. Rows excluded as empty, failed initialization or non-library technical sessions SHALL remain excluded.

#### Scenario: Previously visible conversation crossed the old seven-day boundary
- **WHEN** a user-owned row is `libraryVisible=true`, still exists in storage and was hidden only because its old fixed expiry elapsed
- **THEN** the migration SHALL restore it to the readable conversation library
- **AND** it SHALL preserve messages, title, pin state, creation time and activity time.

#### Scenario: Legacy session was excluded from the library
- **WHEN** a legacy row is `libraryVisible=false` because it was empty, expired before the original migration or contained only failed initialization
- **THEN** the retention migration SHALL NOT promote it into the conversation library.

#### Scenario: Retention migration runs again
- **WHEN** the migration is rerun
- **THEN** it SHALL leave already restored identities and message history unchanged
- **AND** it SHALL NOT duplicate conversations, messages or tool runs.

### Requirement: Conversation library supports deliberate organization
The library SHALL support new conversation, title search, manual rename, pin or unpin, and confirmed deletion for every owner-readable conversation that has not reached an explicit governed expiry.

#### Scenario: Owner organizes an older retained conversation
- **WHEN** an owned conversation is older than seven days and has no governed expiry
- **THEN** the user SHALL still be able to rename, pin, unpin and delete it
- **AND** each operation SHALL preserve the existing conversation identity until deletion.

#### Scenario: Current conversation is deleted
- **WHEN** the user confirms deletion of the active conversation
- **THEN** the conversation and its owned message and tool-run records SHALL be removed according to retention rules
- **AND** the UI SHALL open a new blank conversation while independently persisted platform artifacts remain.
