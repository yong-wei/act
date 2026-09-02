## ADDED Requirements

### Requirement: Retained chat surfaces use the canonical session and stream path

All retained copilot, sidebar, and interactive AI surfaces SHALL use the existing server-owned session/message contracts and C28 normalized provider stream runtime rather than a local legacy chat state machine.

#### Scenario: A retained surface sends a message

- **WHEN** a student, teacher, or other authorized user submits a message
- **THEN** the surface SHALL resolve the authorized session and call the canonical route/runtime
- **AND** it SHALL not select a provider, parse provider chunks, or persist a parallel conversation.

#### Scenario: A surface resumes after refresh

- **WHEN** a user reopens a surface with a governed session
- **THEN** the surface SHALL restore the server-owned bounded history or show an explicit recovery state
- **AND** it SHALL not present an empty local history as a new conversation.

### Requirement: Legacy bridges are removed or isolated at ingress

Legacy hooks, message facades, stream parsers, and aliases SHALL be deleted after their callers migrate; a retained compatibility adapter MUST be limited to ingress conversion and MUST NOT own session, provider, context, or business authority.

#### Scenario: A legacy bridge has no caller

- **WHEN** static and mounted evidence shows no supported caller remains
- **THEN** the bridge SHALL be deleted
- **AND** its replacement SHALL be an existing canonical contract rather than another facade.

#### Scenario: An external shape still needs conversion

- **WHEN** a supported ingress temporarily provides a legacy message shape
- **THEN** one bounded adapter MAY convert it to the canonical contract
- **AND** the adapter SHALL not store conversation state, normalize provider streams, or write business facts.

### Requirement: Session and resource boundaries remain server-authoritative

Bridge retirement SHALL preserve server validation of user, role, course, page, resource, session, and permitted tool scope, including resource isolation during resume and switching.

#### Scenario: User switches interactive resources

- **WHEN** a user changes the current interactive resource or incompatible course session
- **THEN** the new request SHALL use a server-validated session/resource boundary
- **AND** prior resource messages SHALL not enter the new model context without an authorized transition.

#### Scenario: Client supplies a privileged context hint

- **WHEN** a client supplies another user, class, resource, page, provider, or tool hint
- **THEN** the server SHALL reject or ignore the unverified value before model invocation
- **AND** the legacy bridge SHALL not provide a bypass.

### Requirement: Bridge retirement preserves explicit lifecycle and privacy behavior

Canonicalized chat surfaces SHALL retain loading, terminal, retry, abort, timeout, error redaction, focus, and accessibility semantics without exposing provider payloads or sensitive context.

#### Scenario: Provider stream fails or is aborted

- **WHEN** the provider returns an error, times out, or the request is cancelled
- **THEN** the UI SHALL show the existing explicit recoverable/unavailable state and stop duplicate work
- **AND** raw provider errors, secret references, prompts, or private context SHALL not be rendered.

#### Scenario: A native message control receives keyboard input

- **WHEN** Enter or Space activates a retained chat control
- **THEN** the canonical path SHALL process the action exactly once
- **AND** removing a custom bridge handler SHALL not introduce duplicate sends.

### Requirement: AI chat remains advisory

Retiring a bridge SHALL NOT grant AI output authority to create or update course, assessment, learning-record, learner-profile, publication, or production facts.

#### Scenario: Model output contains a business conclusion

- **WHEN** a response suggests a grade, mastery state, revision, publication decision, or production status
- **THEN** it SHALL remain advisory until the relevant canonical owner validates it
- **AND** no legacy or canonical chat surface SHALL persist it as a business fact.
