## ADDED Requirements

### Requirement: AI chat page context is server-verified before system prompt construction

The AI chat route MUST treat browser-supplied page context as an untrusted hint
and MUST resolve the page, course, learner, and permitted scope from
server-owned records before using page context in a private system prompt or
building scoped tools.

#### Scenario: Valid page context is resolved

- **WHEN** an authenticated learner sends a complete page identity that
  resolves to an authorized server-owned course and page
- **THEN** the system uses the resolved server context for the system prompt
  and ignores client-authored title, topic, objectives, stage, and knowledge
  labels as authorities

#### Scenario: Page context is incomplete or unknown

- **WHEN** a request contains a partial, unregistered, or unauthorized page
  context
- **THEN** the route returns `400 INVALID_AI_CONTEXT` before model or tool
  execution and the supplied free-text values do not appear in the system
  prompt

#### Scenario: Client context attempts to expand scope

- **WHEN** a request supplies a client course, page, class, resource, target
  user, or tool hint that differs from the authenticated server scope
- **THEN** the route keeps the server-owned scope and MUST NOT expose tools or
  prompt context for the client-selected scope

### Requirement: Legacy lesson context cannot create system-level instructions

The AI chat route MUST allow only bounded, recognized legacy controls to affect
teaching behavior. Free-text `resourceTitle` and `customPrompt` values MUST be
ignored or rejected before prompt construction and MUST NOT be interpolated
into a system message.

#### Scenario: Instruction-like legacy text is supplied

- **WHEN** a learner sends a multiline or instruction-like `customPrompt` or
  `resourceTitle`
- **THEN** the route does not treat it as system authority, does not disclose
  hidden prompt content, and either returns `400 INVALID_AI_CONTEXT` or safely
  continues with the bounded/base prompt according to the compatibility path

#### Scenario: Bounded legacy controls are supplied

- **WHEN** a request supplies only a recognized teaching stage or assistant
  persona without free-text instructions
- **THEN** the route may apply the corresponding fixed server-owned teaching
  behavior while preserving the base assistant safety rules

### Requirement: Context-free chat remains compatible and truthful

The AI chat route MUST preserve ordinary context-free chat behavior and MUST
not present unverified client descriptions as the learner's current course,
page, evidence, or learning state.

#### Scenario: No context is supplied

- **WHEN** an authenticated learner sends an ordinary chat request without
  page or legacy lesson context
- **THEN** the route uses the existing generic assistant behavior and does not
  require a page-context lookup

#### Scenario: Context cannot be verified

- **WHEN** a page-aware entry point cannot resolve its requested context
- **THEN** the response exposes a stable unavailable/invalid state that the UI
  can handle, rather than claiming verified page-aware guidance

### Requirement: The context boundary is regression-tested

The repository MUST test the AI chat context boundary at both the route and
prompt-construction levels.

#### Scenario: Prompt disclosure regression is exercised

- **WHEN** tests submit instruction-like page or legacy context values
- **THEN** they verify the model is not called with those values as system
  instructions and that no hidden prompt text is returned to the learner

#### Scenario: Valid and compatibility paths are exercised

- **WHEN** tests submit valid server-resolved context and context-free chat
- **THEN** they verify valid page guidance remains available and ordinary chat
  remains behaviorally compatible

