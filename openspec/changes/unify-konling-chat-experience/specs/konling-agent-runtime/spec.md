## ADDED Requirements

### Requirement: Konling uses one visible chat experience
Konling SHALL render visible chat messages, tool calls, diagnostics, and citations through a shared chat experience while preserving page-specific context, tools, and prompt behavior.

#### Scenario: Konling opens from different learning surfaces
- **WHEN** Konling opens from the knowledge graph, adaptive path center, interactive lesson, copilot page, teacher surface, or administrator surface
- **THEN** the visible message layout, tool-call disclosure, diagnostic label, and citation presentation SHALL use the shared Konling chat renderer
- **AND** the surface SHALL pass route-specific context, permitted tools, assistant entry point, and system prompt extension through the shared context boundary.

#### Scenario: A route needs specialized coaching behavior
- **WHEN** a route requires graph, path, resource, lesson, grading, prep-pack, simulation, or administrator-specific behavior
- **THEN** the route SHALL configure that behavior through server-owned context, scoped tools, and prompt extensions
- **AND** it SHALL NOT duplicate message bubble, tool-call, or citation rendering logic.

#### Scenario: Legacy Konling surface remains reachable
- **WHEN** a legacy sidebar, copilot panel, copilot page, or interactive lesson AI panel remains in the codebase
- **THEN** it SHALL wrap or delegate to the shared Konling chat experience
- **AND** it SHALL NOT maintain an independent visible implementation for assistant replies, tool results, or citation lists.

### Requirement: Konling tool calls use collapsible disclosure UI
Konling SHALL render tool calls as a compact collapsible disclosure rather than injecting repeated raw tool-result messages into the answer.

#### Scenario: Assistant message includes tool calls
- **WHEN** an assistant message includes one or more tool calls
- **THEN** the UI SHALL render a collapsed summary showing the number of called tools
- **AND** expanding the summary SHALL reveal one collapsible row per tool call.

#### Scenario: Tool result row is expanded
- **WHEN** a user expands an individual tool-call row
- **THEN** the UI SHALL show sanitized tool result details for that tool call
- **AND** it SHALL keep raw internal diagnostics hidden unless a development-only diagnostic policy explicitly permits them.

#### Scenario: Tool disclosure icons are rendered
- **WHEN** the tool summary or tool row can expand or collapse
- **THEN** the UI SHALL use standard frontend expand and collapse icons
- **AND** it SHALL NOT use literal `>` or `v` characters as the visible affordance.

### Requirement: Konling chat layout prioritizes answer content
Konling SHALL allocate the chat panel layout to prompt input and assistant answer content without avatar placeholders reducing reply width.

#### Scenario: User composes a prompt
- **WHEN** the Konling input composer is visible in the chat window
- **THEN** the prompt input area SHALL occupy about 75 percent of the Konling window width by default, with implementation validation accepting a 70 percent to 80 percent range
- **AND** action buttons SHALL remain reachable without covering the input.

#### Scenario: Assistant reply is rendered
- **WHEN** Konling renders an assistant reply
- **THEN** the reply SHALL use the full available reply width
- **AND** it SHALL NOT reserve an assistant avatar placeholder that narrows the answer column.

## MODIFIED Requirements

### Requirement: Konling streaming citation diagnostics are environment-gated
Konling SHALL separate user-visible streaming answer text from citation-guard debugging diagnostics.

#### Scenario: Development diagnostic injection is enabled
- **WHEN** Konling streams an answer in development and citation-debug injection is enabled
- **THEN** the runtime MAY inject complete citation guard diagnostics into the stream for debugging
- **AND** the visible notice SHALL explicitly identify itself as development-mode diagnostics.

#### Scenario: Production diagnostic injection is disabled
- **WHEN** Konling streams an answer in production and citation-debug injection is not explicitly enabled
- **THEN** the runtime SHALL NOT inject raw citation guard diagnostics into user-visible answer text
- **AND** raw tokens such as `assistant-citations-unverified-stream`, `missing-learner-state`, and `missing-path-execution` SHALL remain outside the visible assistant message.

#### Scenario: Citation diagnostics are persisted
- **WHEN** a Konling answer is generated
- **THEN** the runtime SHALL persist citation guard status, missing citation classes, low-confidence reasons, retrieval source summaries, and personalization availability metadata with the conversation or agent session
- **AND** production visibility of diagnostics SHALL be controlled by environment configuration rather than removing diagnostic persistence.
