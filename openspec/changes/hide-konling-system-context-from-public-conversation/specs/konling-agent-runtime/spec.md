## ADDED Requirements

### Requirement: Public Konling conversation responses exclude internal context records
Every student-facing Konling conversation API SHALL project messages on the server before serialization. The public `messages` collection MUST contain only student-visible `user` and `assistant` messages with approved public metadata and parts. Persisted `system` context records, assistant-binding records, their content and their metadata MUST NOT be returned to the browser. A bounded public `assistantBinding` MAY be derived separately from the complete server-owned history.

#### Scenario: Owner loads a conversation containing page context
- **WHEN** an authenticated owner loads a conversation whose persisted history contains a system page-context record with class, resource, path, release, projection, dataset or Canonical identifiers
- **THEN** the response SHALL preserve the ordered student-visible user and assistant messages
- **AND** the raw response SHALL contain no system message or value copied from that internal context record.

#### Scenario: Conversation contains an assistant-binding record
- **WHEN** the persisted history contains a server-authored assistant-binding system record
- **THEN** the raw response SHALL omit that message and its metadata from `messages`
- **AND** the response MAY include only the separately normalized public `assistantBinding` fields allowed by the existing binding contract.

#### Scenario: Browser code inspects the unrendered response
- **WHEN** student-owned page code, browser developer tools or another same-origin script reads the conversation JSON before React rendering
- **THEN** no client-side visibility filter SHALL be required to protect internal system context
- **AND** the response SHALL already satisfy the student-safe projection boundary.

#### Scenario: Public structured assistant content is restored
- **WHEN** a visible assistant message contains approved citations, revision state, correction state or public structured actions
- **THEN** the public projection SHALL retain the allowed student-facing representation
- **AND** private tool parts and non-public metadata SHALL remain excluded.
