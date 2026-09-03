## MODIFIED Requirements

### Requirement: Konling conversations belong to the authenticated user
Readable Konling conversations, including conversations created or continued from the standalone `/ai/copilot` page, SHALL be owned by one authenticated user and SHALL remain available across supported pages until the user deletes them or existing global retention governance removes them. Every message write SHALL verify conversation ownership and current authorized context before persistence.

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

#### Scenario: Owner continues a conversation from standalone Copilot
- **WHEN** an authenticated user selects an owned conversation on `/ai/copilot` and sends a new message
- **THEN** the runtime SHALL persist the exchange in that conversation
- **AND** the updated conversation SHALL remain available through the shared conversation library.

#### Scenario: Another user requests a standalone Copilot conversation
- **WHEN** a user supplies a conversation identity owned by another user
- **THEN** the runtime SHALL deny access to its title, messages, context records and tool runs
- **AND** it SHALL NOT persist the attempted message.

### Requirement: Cross-page continuation appends context without rewriting history
The runtime SHALL preserve the initiating page context and SHALL append one server-authored current-page context record immediately before a new user message when a shared conversation continues from `/ai/copilot` or another materially different authorized page context. A standalone Copilot task descriptor SHALL be revalidated for the current request and MUST NOT rewrite prior context or expand conversation authority.

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

#### Scenario: Conversation continues on standalone Copilot with a new task context
- **WHEN** an owned conversation continues on `/ai/copilot` with a currently supported portfolio-reflection or evidence task descriptor
- **THEN** the runtime SHALL validate and append the current authorized context before the user message
- **AND** prior system context, messages and task boundaries SHALL remain unchanged.

#### Scenario: Client supplies unauthorized standalone task context
- **WHEN** client hints or historical messages claim evidence, writeback or learner authority outside the current user's authorized task contract
- **THEN** the server SHALL omit or reject those claims before persisting context or invoking the model.
