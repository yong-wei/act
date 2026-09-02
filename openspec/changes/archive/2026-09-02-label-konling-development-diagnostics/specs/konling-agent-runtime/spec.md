## MODIFIED Requirements

### Requirement: Konling streaming citation diagnostics are environment-gated

Konling SHALL separate user-visible streaming answer text from citation-guard debugging diagnostics. Detailed diagnostics MAY be visible only when the environment or an explicitly authorized support override enables injection, and any injected diagnostic block SHALL identify itself as development or support diagnostics and remain distinct from formal citation presentation.

#### Scenario: Development diagnostic injection is enabled
- **WHEN** Konling streams an answer in development and citation-debug injection is enabled
- **THEN** the runtime MAY inject complete citation guard diagnostics into the stream for debugging
- **AND** the visible notice SHALL explicitly identify itself as development-mode diagnostics
- **AND** the notice SHALL not present internal reason codes as verified teaching citations.

#### Scenario: Production diagnostic injection is disabled
- **WHEN** Konling streams an answer in production and citation-debug injection is not explicitly enabled
- **THEN** the runtime SHALL NOT inject raw citation guard diagnostics into user-visible answer text
- **AND** raw tokens such as `assistant-citations-unverified-stream`, `missing-learner-state`, and `missing-path-execution` SHALL remain outside the visible assistant message.

#### Scenario: Authorized support diagnostics are injected
- **WHEN** a separately authorized support-debug override permits detailed diagnostics outside development
- **THEN** the visible block SHALL identify itself as support or development diagnostics
- **AND** it SHALL remain visually and semantically distinct from formal verified citation presentation.

#### Scenario: Citation diagnostics are persisted
- **WHEN** a Konling answer is generated
- **THEN** the runtime SHALL persist citation guard status, missing citation classes, low-confidence reasons, retrieval source summaries, and personalization availability metadata with the conversation or agent session
- **AND** production visibility of diagnostics SHALL be controlled by environment configuration rather than removing diagnostic persistence.
