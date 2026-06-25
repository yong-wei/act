## ADDED Requirements

### Requirement: Konling streaming citation diagnostics are environment-gated
Konling SHALL separate user-visible streaming answer text from citation-guard debugging diagnostics.

#### Scenario: Development debug injection is enabled
- **WHEN** Konling streams an answer in a development environment or an explicitly enabled debug-injection environment
- **THEN** the runtime MAY inject complete citation guard diagnostics into the stream for debugging
- **AND** the injected diagnostics SHALL include missing context and low-confidence reasons for any authenticated development user account.

#### Scenario: Production debug injection is disabled
- **WHEN** Konling streams an answer in production and citation-debug injection is not explicitly enabled
- **THEN** the runtime SHALL NOT inject raw citation guard diagnostics into user-visible answer text
- **AND** raw tokens such as `assistant-citations-unverified-stream`, `missing-learner-state`, and `missing-path-execution` SHALL remain outside the visible assistant message.

#### Scenario: Citation diagnostics are persisted
- **WHEN** Konling produces a streaming or persisted-session reply
- **THEN** the runtime SHALL persist citation guard status, missing citation classes, low-confidence reasons, retrieval source summaries, and personalization availability metadata with the conversation or agent session
- **AND** support review SHALL be possible without exposing raw diagnostics as normal student-facing prose.

### Requirement: Konling citation requirements follow answer intent
Konling SHALL determine required citation classes from the answer intent and the claims made by the response.

#### Scenario: Concept explanation has content citations
- **WHEN** a user asks for a course concept explanation from graph center or another content-grounded surface
- **THEN** Konling SHALL generate a cited answer when authorized content, graph, textbook, handout, or knowledge-card citations are available
- **AND** missing learner-state or path-execution data SHALL NOT by itself make the content citation guard fail.

#### Scenario: Personalized answer lacks learner data
- **WHEN** a user asks for personalized diagnosis, path advice, remediation, grading explanation, report explanation, or intervention advice and learner-state or path-execution data is missing
- **THEN** Konling SHALL still return a cited answer from available teaching content and retrieval sources where possible
- **AND** it SHALL mark personalization as limited instead of fabricating learner-specific claims.

#### Scenario: Personalized answer uses learner data
- **WHEN** authorized learner-state, path-execution, or evidence citations are available and the answer makes personalized claims
- **THEN** Konling SHALL use those citations to shape answer scope, style, emphasis, and recommendations
- **AND** the response metadata SHALL distinguish available personalization evidence from general content citations.

#### Scenario: Content citations are unavailable
- **WHEN** no authorized content or retrieval citation is available for a content-grounded claim
- **THEN** Konling SHALL block, redact, downgrade, or provide a user-safe limitation
- **AND** it SHALL NOT treat missing learner-state data as a substitute for missing content evidence.

### Requirement: Konling visible limitations are user-safe
Konling SHALL translate internal citation and personalization limitations into student-safe explanations when a visible limitation is needed.

#### Scenario: Visible limitation is needed
- **WHEN** a response must disclose limited personalization or citation confidence to a student
- **THEN** the visible text SHALL describe the limitation in product language such as insufficient personal learning record or limited path history
- **AND** it SHALL NOT expose raw field names, debug tokens, provider diagnostics, hidden context ids, or audit-only reason codes.
