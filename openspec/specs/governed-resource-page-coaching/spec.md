# governed-resource-page-coaching Specification

## Purpose
TBD - created by archiving change add-version-bound-resource-context-questioning. Update Purpose after archive.
## Requirements
### Requirement: First delivery supports one governed textbook reader surface
The first governed resource-page coaching integration SHALL support only one unified textbook reader runtime v2 structural unit and its optional registered formula, figure, or table fragment. Other resource types SHALL require later explicit adapters.

#### Scenario: Authorized reader opens contextual coaching
- **WHEN** an authorized user opens Konling from a unified textbook reader runtime v2 unit
- **THEN** the system SHALL establish resource coaching for that exact structural unit
- **AND** it SHALL identify the first adapter as `structured-textbook-unit`.

#### Scenario: Unsupported resource page requests contextual coaching
- **WHEN** a caller requests this capability for a lesson-engine TeachingResource, KnowledgeCard, `/knowledge` panel, PDF, video timeline, or external webpage
- **THEN** the capability SHALL remain unavailable for that resource type
- **AND** it MUST NOT approximate the context from a title, current URL, selected text, or generic page metadata.

### Requirement: Resource context is reconstructed from a canonical server-owned identity
The system SHALL bind each textbook resource-coaching request to `resourceId`, `bookId`, `edition`, `sourceRevision`, `unitId`, `contentHash`, and an optional registered `anchorId`. For the first adapter, `unitId` SHALL be the stable `blockId`; the implementation SHALL NOT create a parallel block identity. The server SHALL authorize and reload the addressed runtime content before exposing any resource body or citation metadata to Konling.

#### Scenario: Structural unit identity validates
- **WHEN** the authenticated actor may read the addressed textbook and all identity fields resolve to one runtime v2 unit whose computed content hash matches
- **THEN** the server SHALL construct a bounded unit-level context from that fixed resource
- **AND** it SHALL expose only server-assigned citation identifiers for that unit.

#### Scenario: Registered fragment identity validates
- **WHEN** `anchorId` identifies a formula, figure, or table registered to the validated unit
- **THEN** the server SHALL construct the bounded fragment context with its surrounding authored unit context
- **AND** any precise return address SHALL target that same unit and anchor.

#### Scenario: No stable paragraph anchor exists
- **WHEN** the user selects ordinary text that has no registered stable fragment anchor
- **THEN** the selection MAY be retained as a bounded question hint after the unit is verified
- **AND** the system MUST NOT treat DOM offsets, line numbers, selected bytes, or the visible URL as a persistent citation identity.

#### Scenario: Client identity or content is tampered
- **WHEN** the client changes the resource id, book, edition, revision, unit, hash, anchor, visible body, offset, selection, or proposed URL so that it does not match the server-owned projection
- **THEN** the server SHALL reject or discard the unverified fields
- **AND** the tampering MUST NOT expand authorization, model context, or clickable citation scope.

### Requirement: Resource-coaching sessions remain pinned to one verified version
The system SHALL atomically persist the complete server-verified resource identity in server-owned conversation state before the first resource-grounded answer and SHALL revalidate that identity and current actor authorization on every turn. Client replay MUST NOT establish or replace the pinned state, and the system MUST NOT silently replace it with the active or latest resource version.

#### Scenario: Active runtime updates while the pinned revision remains readable
- **WHEN** a newer active runtime is published after the session starts but the pinned revision, unit, hash, and anchor still validate
- **THEN** subsequent turns SHALL continue using the pinned resource identity
- **AND** the session SHALL NOT relabel old answers or citations as belonging to the newer version.

#### Scenario: Pinned revision becomes unavailable
- **WHEN** the pinned revision can no longer be read or its unit mapping can no longer be verified
- **THEN** resource coaching SHALL enter an explicit version-unavailable state
- **AND** it MUST NOT fall back to the latest revision, a same-titled unit, the whole book, or neighboring content.

#### Scenario: Content hash drifts within the claimed identity
- **WHEN** the server-loaded unit hash differs from the pinned `contentHash`
- **THEN** resource coaching SHALL fail closed with a version-changed or integrity state
- **AND** it MUST NOT send the changed body to the existing session.

#### Scenario: Authorization changes during a session
- **WHEN** the actor loses textbook access after a resource-coaching session was established
- **THEN** the next request SHALL be denied
- **AND** it MUST NOT disclose resource body, anchor details, or citation metadata from the prior authorization state.

### Requirement: Answer citations preserve the pinned resource identity
Every clickable citation produced by resource-page coaching SHALL be hydrated from a server-owned CitationAddress that matches the session resource id, source revision, unit id, content hash, and optional anchor. Its href SHALL use a same-origin server-issued version-bound navigation handle or an equivalent target whose click-time resolution can render that exact verified identity. A normal active-reader URL without version binding SHALL be insufficient for a pinned old-version citation. Model-authored URLs and unverified identifiers SHALL never become verified links.

#### Scenario: Verified unit citation is returned
- **WHEN** an answer is supported by the pinned structural unit and its server-owned version-bound CitationAddress validates at click time
- **THEN** the citation SHALL show the resource title and a safe href for that same version-bound unit
- **AND** following it SHALL open or focus that exact revision and unit.

#### Scenario: Verified fragment citation is returned
- **WHEN** an answer is supported by a registered fragment belonging to the pinned unit
- **THEN** the citation SHALL include the registered anchor and focus that fragment
- **AND** the reader and answer metadata SHALL refer to the same revision, unit, hash, and anchor.

#### Scenario: Anchor is no longer valid
- **WHEN** a proposed citation anchor is absent from the pinned unit or cannot be verified
- **THEN** the citation SHALL expose a bounded location-unavailable state
- **AND** it MUST NOT navigate to the resource home, whole book, same-named anchor, or another version as if the location were exact.

#### Scenario: Active reader revision differs from the pinned citation
- **WHEN** a session is pinned to R1, the active runtime is R2, and the version-bound target cannot produce an exact R1 reader projection
- **THEN** the citation SHALL be non-clickable or its navigation SHALL fail closed while preserving the current reader position
- **AND** the system MUST NOT open R2 through the ordinary active-reader URL as if it were the R1 source.

#### Scenario: Citation URL or identity is not server verified
- **WHEN** model output contains a URL, unknown citation id, cross-resource target, cross-version target, or mismatched content hash
- **THEN** it SHALL NOT become a clickable verified citation
- **AND** the answer SHALL expose the applicable unverified or limited-citation state.

### Requirement: Coaching panel preserves explicit reading position
Opening or closing the resource-coaching panel SHALL not remount the textbook body or lose the current unit, fragment, scroll position, focus, or reading state. The reader's latest valid live reading state SHALL remain authoritative while the panel is open. A verified citation followed by the user or direct reader navigation MAY intentionally establish a new reading position.

#### Scenario: User continues reading while the panel is open
- **WHEN** the user directly scrolls, changes unit, changes fragment, or otherwise establishes position B after opening the panel at position A
- **THEN** closing the panel SHALL preserve the latest valid position B
- **AND** it MUST NOT restore position A merely because no citation was followed.

#### Scenario: Panel layout moves the reader without user navigation
- **WHEN** opening or closing the panel causes a layout-driven displacement and no user reading-position event occurred while the panel was open
- **THEN** the reader MAY use its opening snapshot to restore the prior valid position
- **AND** reopening the panel SHALL retain the version-bound conversation state.

#### Scenario: User follows a verified citation
- **WHEN** the user activates a verified unit or fragment citation
- **THEN** the reader SHALL focus the exact validated target
- **AND** closing the panel SHALL preserve that user-selected target as the new reading position.

#### Scenario: User activates an unavailable citation
- **WHEN** a citation is limited, version-changed, or location-unavailable
- **THEN** the reader SHALL keep its current position and expose the limitation
- **AND** focus SHALL remain on or return to a meaningful control without navigating to a guessed target.

### Requirement: First-surface acceptance covers trust and lifecycle boundaries
The textbook reader integration SHALL provide deterministic tests for canonical identity, per-turn authorization, pinned-version behavior, hash and anchor drift, citation integrity, and reader lifecycle preservation.

#### Scenario: Acceptance suite exercises the governed loop
- **WHEN** focused server, runtime, component, and browser acceptance runs
- **THEN** it SHALL cover authorized unit context, representative registered fragments, tampered client fields, atomic server-side session binding, permission revocation, active-version update, unavailable pinned revision, hash drift, anchor loss, model-authored URL rejection, exact-version navigation or refusal, direct reading while the panel is open, layout-only restoration, and explicit citation navigation
- **AND** it SHALL verify that unsupported resource pages receive no new contextual-coaching behavior.

