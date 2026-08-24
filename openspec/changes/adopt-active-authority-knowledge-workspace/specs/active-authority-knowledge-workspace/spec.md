## ADDED Requirements

### Requirement: Knowledge workspace resolves the active Authority from the committed selector
The system SHALL expose the current Authority graph only through a server-resolved, identity-validated active contract bound to the named `engineering-graph` consumer. The contract SHALL be available only when that consumer selection is `use-combination`, its status is `READY`, and its Authority snapshotId/hash/releaseId match the resolved immutable materialization. Its combination projectionId/projectionHash SHALL be `null`; a Teaching Projection selector SHALL NOT gate Engineering graph availability. The response SHALL include only role-appropriate Authority and activation provenance and SHALL identify projection as not applicable rather than inventing an Engineering graph projection.

#### Scenario: Active graph is available after production cutover
- **WHEN** a viewer entitled to `/knowledge` opens the workspace and the committed `engineering-graph` READY combination and Authority identities validate
- **THEN** the workspace SHALL default to the active graph and identify the resolved Authority Snapshot/Release, activation identity and applicable projection provenance
- **AND** it SHALL not use a fixed candidate Release as the current graph

#### Scenario: Engineering graph is ready without a teaching projection
- **WHEN** the committed `engineering-graph` combination is `READY` with matching Authority identity and null projectionId/projectionHash
- **THEN** the active graph SHALL be available
- **AND** a valid or unavailable Teaching Projection selector SHALL not change that Engineering graph availability result

#### Scenario: Activation consumer selection is absent or not ready
- **WHEN** the `engineering-graph` selection is absent, is not `use-combination`, is not `READY`, or does not match the resolved Authority identity
- **THEN** the active API SHALL fail closed
- **AND** it SHALL not fall through to a global Authority pointer or a Legacy API

#### Scenario: Client attempts to choose an authority identity
- **WHEN** a request supplies a snapshot, release, manifest, selector path or equivalent graph identity through URL or client state
- **THEN** the active API SHALL ignore that supplied identity and resolve only the server-side current selector

#### Scenario: Active provenance is projected by role
- **WHEN** student, teacher and administrator view the same active Authority object
- **THEN** each response SHALL retain the same resolved Authority identity
- **AND** only the role-permitted provenance fields SHALL be exposed
- **AND** no host path, credential or unreviewed store field SHALL appear in the public response

### Requirement: Active Authority and historical Legacy views remain independent
The system SHALL keep active Authority and historical Legacy graph data on independent API and rendering paths. Switching views SHALL replace the current view state without combining graph objects, relations, details or API responses.

#### Scenario: User switches to historical Legacy
- **WHEN** a viewer selects historical Legacy from an active Authority workspace
- **THEN** the client SHALL load the Legacy view through its existing Legacy contract
- **AND** it SHALL label the view as historical Legacy
- **AND** it SHALL not retain active Authority nodes or relations in the Legacy canvas or detail panel

#### Scenario: User returns to active Authority
- **WHEN** a viewer switches from historical Legacy back to active Authority
- **THEN** the client SHALL request the active contract again and reset incompatible Legacy selection state
- **AND** it SHALL not derive an active node or relation from Legacy data

#### Scenario: Active graph is unavailable
- **WHEN** the active `engineering-graph` selection, Authority identity or active API validation is absent, corrupt or mismatched
- **THEN** the active view SHALL show an explicit unavailable state with the failure category suitable for the viewer role
- **AND** it SHALL not automatically query or render Legacy data as a fallback

### Requirement: Candidate diagnostic remains distinct from current Authority
The system SHALL treat the fixed candidate graph as an explicitly labelled, administrator-controlled diagnostic view rather than the ordinary current graph.

#### Scenario: Ordinary viewer opens current workspace
- **WHEN** a non-administrator opens `/knowledge` after active Authority validation succeeds
- **THEN** the workspace SHALL select active Authority by default
- **AND** it SHALL not request the fixed candidate API

#### Scenario: Administrator opens controlled candidate diagnostics
- **WHEN** an administrator is authorized for controlled candidate verification and explicitly selects the candidate diagnostic view
- **THEN** the client SHALL use the independent candidate API and display its fixed ReleaseSet/Release identity
- **AND** it SHALL not present the candidate as the current Authority or combine it with active or Legacy data

### Requirement: Workspace mode changes do not mutate authority or learning state
The system SHALL keep graph-mode selection as local presentation state. It SHALL NOT mutate selectors, activation manifests, learner facts, progress, course bindings or server-side graph state when a viewer opens or switches graph modes.

#### Scenario: Viewer changes graph mode
- **WHEN** a viewer selects active Authority, historical Legacy or an allowed candidate diagnostic
- **THEN** the system SHALL change only the rendered view and local interaction state
- **AND** it SHALL not write a graph activation pointer or learning record

### Requirement: Active workspace has a client-safe contract boundary
The active workspace client SHALL consume only browser-safe API contracts and pure presentation helpers. It SHALL NOT import activation stores, filesystem resolvers, Node built-ins or server-only layered-graph modules.

#### Scenario: Client workspace is bundled
- **WHEN** the production Next/Turbopack build bundles the active workspace
- **THEN** the client bundle SHALL resolve without a server-only import
- **AND** a structural regression test SHALL reject a reintroduced server-only import path
