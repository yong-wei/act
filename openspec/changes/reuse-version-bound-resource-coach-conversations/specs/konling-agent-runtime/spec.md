## ADDED Requirements

### Requirement: Konling exposes server-owned assistant-binding lookup
The Konling conversation runtime SHALL expose a bounded owner-scoped way to identify conversations whose persisted teaching-assistant binding exactly matches a currently authorized resource-coach identity. The lookup SHALL NOT expose raw messages, private mode context or another user's conversation metadata.

#### Scenario: Exact persisted binding matches
- **WHEN** an authenticated user requests a conversation for an authorized resource-coach identity that exactly matches an owned persisted binding
- **THEN** the runtime SHALL return or select that conversation as the matching session
- **AND** the client SHALL be able to recover its visible messages without creating a replacement.

#### Scenario: Client-only binding is supplied
- **WHEN** the requested identity exists only in `sessionStorage`, URL state or other client hints and cannot be revalidated on the server
- **THEN** the runtime SHALL NOT treat it as a persisted match or grant resource access.

#### Scenario: Binding belongs to another user or version
- **WHEN** a candidate conversation belongs to another user or differs in revision, unit, content hash or normalized anchor
- **THEN** the runtime SHALL exclude it from the match.

### Requirement: Resource-coach creation does not leave visible unbound sessions
When no matching resource-coach conversation exists, the runtime SHALL establish the new owned conversation and validated binding no earlier than the user's first intentional question and before model execution. Creation retries SHALL be idempotent for the same user and exact resource identity, and a failed first-turn setup MUST NOT leave a `libraryVisible=true` conversation without a recoverable binding.

#### Scenario: User submits the first resource question
- **WHEN** the authorized user submits the first question from an unpersisted blank resource-coach state
- **THEN** the runtime SHALL create or reuse one owned conversation and persist the verified binding before invoking the model.

#### Scenario: Two first questions race
- **WHEN** two requests concurrently attempt to start coaching for the same user and exact resource identity
- **THEN** the runtime SHALL select one recoverable conversation identity or otherwise prevent duplicate visible empty sessions.

#### Scenario: Binding setup fails
- **WHEN** authorization, version validation or persistence fails before the first answer
- **THEN** the runtime SHALL return an explicit failure
- **AND** it SHALL not leave a visible unbound conversation in the user's library.
