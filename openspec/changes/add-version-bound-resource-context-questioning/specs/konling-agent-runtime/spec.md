## ADDED Requirements

### Requirement: Resource coach consumes version-bound textbook context
Konling `resource-coach` SHALL accept unified textbook reader context only after the server has authorized and resolved a complete `structured-textbook-unit` identity. Client page context SHALL remain a hint and SHALL NOT establish trusted resource body, version, anchor, permission, or citation scope.

#### Scenario: Textbook resource coach becomes ready
- **WHEN** the current actor is authorized and the server validates `resourceId`, `bookId`, `edition`, `sourceRevision`, `unitId`, `contentHash`, and any requested registered `anchorId`
- **THEN** `resource-coach` SHALL use the server-reloaded bounded unit or fragment context
- **AND** the server SHALL atomically persist that complete resource identity before producing the first grounded answer.

#### Scenario: Subsequent turn uses the resource session
- **WHEN** the user asks another question in an existing version-bound resource-coach session
- **THEN** Konling SHALL reauthorize the actor and revalidate the pinned revision, unit, hash, and anchor before using resource context
- **AND** client hints or a newer active runtime SHALL NOT silently replace the session identity.

#### Scenario: Resource context cannot be revalidated
- **WHEN** permission is denied, the pinned revision is unavailable, the content hash drifts, the unit mapping changes, or the anchor is invalid
- **THEN** `resource-coach` SHALL return a visible unavailable or degraded reason appropriate to the failure
- **AND** it SHALL NOT answer from generic chat as though it had verified the requested resource context.

#### Scenario: Resource-grounded answer exposes citations
- **WHEN** Konling returns an answer supported by the verified textbook context
- **THEN** answer metadata SHALL include only server-assigned citation identifiers whose hydrated version-bound addresses match the pinned resource identity and can resolve that exact identity at click time
- **AND** missing or unverified support SHALL be labeled as having no verifiable citation rather than supplemented with a model-authored source.
