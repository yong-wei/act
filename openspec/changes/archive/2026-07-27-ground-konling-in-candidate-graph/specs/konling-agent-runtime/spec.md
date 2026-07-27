## ADDED Requirements

### Requirement: Konling uses candidate Canonical page context
When Konling is invoked from the candidate graph, it MUST receive the current ReleaseSet identity, selected Canonical Object, graph filters, and candidate coverage state.

#### Scenario: Selected candidate object is explained
- **WHEN** the user asks about the selected Canonical Object
- **THEN** Konling SHALL use its Canonical ID and ReleaseSet rather than searching Legacy nodes by label

### Requirement: Candidate graph exposes a focused read-only tool set
The candidate graph context SHALL expose Repository-backed Canonical search, node detail, and bounded neighbor tools, and SHALL exclude state-changing knowledge actions.

#### Scenario: Model searches neighbors
- **WHEN** Konling requests related candidate objects
- **THEN** the tool SHALL return precise predicate, direction, governance level, and ReleaseSet provenance

#### Scenario: Model attempts a state-changing action
- **WHEN** a candidate response attempts to create a learning fact, execute a path, or update learner state
- **THEN** the server SHALL reject the action and preserve the candidate context as read-only

### Requirement: Candidate context does not replace platform context injection
The candidate graph additions MUST extend the existing page-scoped context contract without creating a graph-only assistant mode.

#### Scenario: Conversation continues on another page
- **WHEN** the same user opens the conversation elsewhere and sends a new message
- **THEN** the runtime SHALL append the new page context before the message while retaining the prior conversation structure

### Requirement: Candidate graph public activation waits for Konling acceptance
The system MUST keep the candidate graph unavailable to ordinary users until its Canonical context, focused tools, diagnostics, and no-side-effect gates all pass acceptance.

#### Scenario: Candidate Konling acceptance passes
- **WHEN** V2 graph acceptance and all candidate Konling read-only tests pass on the same ReleaseSet
- **THEN** the system SHALL open the candidate view to all existing graph users and set it as the migration-period default

#### Scenario: Candidate Konling acceptance fails
- **WHEN** any candidate context, provenance, or side-effect test fails
- **THEN** the public activation gate SHALL remain closed and users SHALL continue on the Legacy graph
