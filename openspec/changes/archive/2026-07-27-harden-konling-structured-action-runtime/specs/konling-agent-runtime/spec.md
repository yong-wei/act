## ADDED Requirements

### Requirement: Provider tool-call syntax never renders as assistant prose
The Konling runtime SHALL normalize streamed and final provider events into text, tool-call, tool-result, citation, and terminal events before user-visible rendering.

#### Scenario: Provider returns DSML tool syntax
- **WHEN** a provider emits a complete recognized DSML or provider-specific tool-call envelope
- **THEN** the runtime SHALL parse it into a structured tool call
- **AND** the envelope SHALL NOT appear in the assistant's visible text.

#### Scenario: Structured syntax is malformed
- **WHEN** deterministic parsing cannot safely classify a possible tool-call envelope
- **THEN** the runtime SHALL withhold the raw syntax and enter bounded correction or an actionable failure state
- **AND** it SHALL NOT present the markup as a successful answer.

### Requirement: Tool runs and structured actions persist with their assistant turn
Each structured action SHALL be linked to a persisted assistant turn and tool-run identity so reopening a conversation restores the same card and state.

#### Scenario: Tool call completes
- **WHEN** a permitted tool call succeeds or fails
- **THEN** its redacted input summary, output or error summary, status, timestamps, and idempotency identity SHALL be persisted
- **AND** the message renderer SHALL reconstruct its action or status card from server records.

#### Scenario: Conversation is reopened
- **WHEN** the user reopens a conversation containing structured actions
- **THEN** applied, ignored, failed, and pending action states SHALL render consistently
- **AND** reopening SHALL NOT rerun a completed tool automatically.

### Requirement: Smart-preparation proposals render as in-message action cards
The `propose_smart_lesson_task_change` result SHALL render inside the responsible assistant message with `应用` and `忽略` actions.

#### Scenario: Proposal card is presented
- **WHEN** a structured task proposal is persisted
- **THEN** the card SHALL show a teacher-readable summary of the proposed changes before any task mutation
- **AND** no proposal SHALL apply until the teacher selects `应用`.

#### Scenario: Teacher applies a current proposal
- **WHEN** the teacher selects `应用` and the task revision still matches
- **THEN** the structured task service SHALL apply the proposed diff once
- **AND** the affected smart-preparation accordion stage SHALL update, highlight the accepted change briefly, and then return to its ordinary presentation.

#### Scenario: Proposal conflicts with a newer task revision
- **WHEN** the task changed after the proposal was created
- **THEN** the action card SHALL report the conflict and offer refresh or a new proposal
- **AND** it SHALL NOT overwrite the newer task.

#### Scenario: Teacher ignores a proposal
- **WHEN** the teacher selects `忽略`
- **THEN** the card SHALL persist the ignored state
- **AND** the task SHALL remain unchanged.

#### Scenario: Proposal application fails
- **WHEN** an authorized proposal cannot be applied for a reason other than a stale revision
- **THEN** the original card SHALL persist an actionable failure state
- **AND** the task SHALL remain unchanged and a duplicate click SHALL not apply the proposal twice.

### Requirement: Page-specific Konling tools remain focused
Each page or assistant mode SHALL continue to expose only its authorized focused tool set while retaining the project's existing context injection.

#### Scenario: Conversation opens in a new page context
- **WHEN** an existing conversation continues on another page
- **THEN** the runtime SHALL use that page's permitted tools for the new turn
- **AND** it SHALL not retroactively alter tools or context recorded for prior turns.

### Requirement: Tool-call correction consumes the shared message-revision contract
Konling tool-call correction SHALL reuse the provisional-message identity, `正在后台优化响应` state, same-message replacement, and bounded p95 wait defined by `integrate-konling-textbook-rag`.

#### Scenario: Tool-call correction is required
- **WHEN** deterministic normalization withholds malformed structured syntax and starts the single permitted correction
- **THEN** the correction SHALL update the existing provisional message through the shared message-revision contract
- **AND** this change SHALL NOT create a second visible answer, wait controller, or message replacement implementation.
