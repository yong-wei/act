# standalone-copilot-conversation Specification

## Purpose
TBD - created by archiving change connect-standalone-copilot-to-conversation-library. Update Purpose after archive.
## Requirements
### Requirement: Standalone Copilot uses an owned persistent conversation
For an authenticated student, `/ai/copilot` SHALL create or select a Konling conversation owned by that student before sending a message, and SHALL bind the chat request to the verified conversation identity. The page MUST NOT treat an in-memory message array as the durable conversation record.

#### Scenario: Student sends the first message from a blank page
- **WHEN** an authenticated student opens `/ai/copilot` without an active conversation and submits a message
- **THEN** the system SHALL create one owned Konling conversation before model execution
- **AND** the user and assistant messages SHALL be persisted in that conversation.

#### Scenario: Client supplies another user's conversation id
- **WHEN** the client attempts to continue a conversation not owned by the authenticated student
- **THEN** the server SHALL reject access before exposing messages or persisting the new prompt.

### Requirement: Standalone Copilot restores visible conversation history
The page SHALL restore the selected conversation's student-visible user and assistant messages after refresh, reopen or selection. Internal system context, private tool records and authorization metadata MUST NOT be rendered as ordinary chat messages.

#### Scenario: Student refreshes an active conversation
- **WHEN** a persisted conversation has completed messages and the student refreshes `/ai/copilot`
- **THEN** the page SHALL recover the same visible message order from the server-owned conversation
- **AND** it SHALL NOT silently replace the history with an empty local state.

#### Scenario: Conversation recovery fails
- **WHEN** the selected conversation cannot be loaded
- **THEN** the page SHALL present a recovery failure and retry or new-conversation action
- **AND** it SHALL NOT describe the failed read as a conversation with no messages.

#### Scenario: Student changes selection during a pending load
- **WHEN** an earlier conversation load completes after the student selected another conversation
- **THEN** the stale result SHALL NOT replace the newer active conversation or its messages.

### Requirement: Conversation lifecycle actions reflect persistent state
The standalone page SHALL provide a real new-conversation action and a confirmed delete action. Hiding local messages MUST NOT be represented as deleting or clearing persisted history.

#### Scenario: Student starts a new conversation
- **WHEN** the student activates the new-conversation action
- **THEN** the page SHALL enter a blank owned conversation state without deleting prior conversations
- **AND** the prior conversation SHALL remain available in the user's library.

#### Scenario: Student deletes the active conversation
- **WHEN** the student confirms deletion of the active conversation
- **THEN** the existing conversation deletion contract SHALL remove that owned history
- **AND** the page SHALL move to a new blank conversation state.

### Requirement: Persisted conversations do not expand Copilot task authority
Continuing a persisted conversation SHALL preserve current server-owned task contracts and evidence authorization. Historical messages and client navigation values MUST NOT grant portfolio, evidence, save, score or learner-state authority.

#### Scenario: Conversation continues in portfolio-reflection context
- **WHEN** a student continues a conversation from a portfolio-reflection entry
- **THEN** the current bounded reflection descriptor SHALL be revalidated before model execution
- **AND** the response SHALL remain a candidate until the existing explicit-save flow is used.

#### Scenario: Conversation continues in Evidence Copilot context
- **WHEN** the current entry requests evidence-grounded assistance
- **THEN** the server SHALL resolve only evidence authorized for the current student and task
- **AND** historical conversation text SHALL NOT be treated as governed learning evidence.

### Requirement: Conversation use remains side-effect bounded
Creating, reading, continuing, selecting or deleting a standalone Copilot conversation SHALL NOT by itself create or modify LearningFact, learner portrait, official grades, rankings or formal reflection records.

#### Scenario: Student reopens a conversation
- **WHEN** the student reloads or selects an existing conversation
- **THEN** the system SHALL only read the conversation and permitted context
- **AND** it SHALL NOT promote chat content into formal learning state.

### Requirement: Standalone Copilot entry presentation matches governed learning context
The standalone `/ai/copilot` page SHALL derive its welcome copy, capability statements, suggested questions, input example, limitation state and adjacent actions from the current server-governed task context and available student-safe projections. The page MUST NOT present a fixed simulation, control method, engineering standard, runtime state or personal evidence as the current student's context when that context is not bound and authorized.

#### Scenario: Student opens Copilot without a bound task
- **WHEN** an authenticated student opens `/ai/copilot` without a registered task context
- **THEN** the page SHALL present a neutral learning-assistance state with general concept, reflection and planning actions
- **AND** it SHALL state that no specific course step, simulation state or personal evidence is currently bound.

#### Scenario: Generic entry has no simulation runtime
- **WHEN** the neutral entry has no authorized simulation state or simulation tool binding
- **THEN** the welcome copy, suggested questions and input example SHALL NOT claim current simulation access, ship-control context, PID tuning, Nomoto data or CCS review
- **AND** selecting a suggested question SHALL NOT request unavailable simulation runtime data.

#### Scenario: Student enters portfolio reflection
- **WHEN** the current registered task is `portfolio-reflection`
- **THEN** the page SHALL present reflection-specific goals, candidate-draft questions and the existing explicit portfolio action
- **AND** it SHALL NOT describe the candidate as an already saved learning record.

#### Scenario: Student enters Evidence Copilot
- **WHEN** the current registered task is `evidence-copilot`
- **THEN** the page SHALL align its copy and suggested questions with the server-authorized evidence projection
- **AND** missing or unavailable evidence SHALL produce a limitation state and a real adjacent evidence-creation or learning action.

#### Scenario: Client supplies an unregistered context value
- **WHEN** the URL contains an unsupported `context`, `source`, `assignment` or `intent` combination
- **THEN** the page SHALL fall back to the neutral entry or reject the invalid task descriptor
- **AND** it SHALL NOT present the client text as verified learning context, evidence or capability.

#### Scenario: Entry presentation is verified in the browser
- **WHEN** representative neutral, reflection and evidence states are rendered at desktop and 320px widths
- **THEN** each visible capability and adjacent action SHALL be executable in that state
- **AND** the page SHALL preserve keyboard focus, readable text and no horizontal overflow.

