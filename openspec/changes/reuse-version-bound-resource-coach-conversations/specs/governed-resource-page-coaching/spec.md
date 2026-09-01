## MODIFIED Requirements

### Requirement: Resource-coaching sessions remain pinned to one verified version
The system SHALL atomically persist the complete server-verified resource identity in server-owned conversation state before the first resource-grounded answer and SHALL revalidate that identity and current actor authorization on every turn. Reopening the same governed resource identity SHALL restore an existing owned matching conversation when available. Client replay and browser-only storage MUST NOT establish, replace or recover the pinned state, and the system MUST NOT silently replace it with the active or latest resource version.

#### Scenario: Matching resource-coaching conversation exists
- **WHEN** the authorized user opens coaching for the same `resourceId`, `sourceRevision`, `unitId`, `contentHash` and normalized `anchorId` as an existing owned conversation
- **THEN** the system SHALL restore that conversation and its visible history
- **AND** it SHALL NOT create a new conversation merely because client hydration is incomplete.

#### Scenario: No matching conversation exists
- **WHEN** the conversation lookup completes and no owned exact match exists
- **THEN** the panel SHALL present an unpersisted blank coaching state
- **AND** it SHALL create and bind a conversation only when the user intentionally submits the first question.

#### Scenario: Active runtime updates while the pinned revision remains readable
- **WHEN** a newer active runtime is published after the session starts but the pinned revision, unit, hash and anchor still validate
- **THEN** subsequent turns SHALL continue using the pinned resource identity
- **AND** reopening that exact pinned identity SHALL restore the same conversation.

#### Scenario: Pinned revision becomes unavailable
- **WHEN** the pinned revision can no longer be read or its unit mapping can no longer be verified
- **THEN** resource coaching SHALL enter an explicit version-unavailable state
- **AND** it MUST NOT create a latest-version conversation as if it were the prior session.

### Requirement: First-surface acceptance covers trust and lifecycle boundaries
The textbook reader integration SHALL provide deterministic tests for canonical identity, per-turn authorization, pinned-version behavior, hash and anchor drift, citation integrity, reader lifecycle preservation, conversation hydration and duplicate-creation prevention.

#### Scenario: Acceptance suite exercises conversation reuse
- **WHEN** focused server, runtime, component and browser acceptance runs
- **THEN** it SHALL cover delayed conversation loading, exact matching reuse, first-question creation, refresh/reopen, concurrent first questions, different revision/hash/anchor, permission revocation and creation failure
- **AND** it SHALL prove that page mount, panel open and refresh without a submitted question do not create additional visible conversations.
