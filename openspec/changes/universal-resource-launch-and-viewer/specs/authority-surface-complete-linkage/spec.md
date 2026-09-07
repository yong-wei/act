## MODIFIED Requirements

### Requirement: System resources have no orphans
Every resource record in the active Teaching Projection MUST have at least one binding to a current Authority object, a human-readable title, and a launcher-safe descriptor for its type. A resource without a binding, or a binding to a missing object, MUST fail closed. Empty titles MUST NOT be projected as available items. Every launchable type — lesson, handout, step, video, audio, exercise, card, infographic, textbook, and simulation — MUST resolve a launch target for its bound resources; the launch-target map MUST NOT silently drop a projected type into an unavailable default branch.

#### Scenario: Resource is bound to a live node
- **WHEN** a video, audio, card, exercise, lesson, handout, step, infographic, textbook, or simulation resource has a binding to a current canonical id and a non-empty title
- **THEN** selecting that node SHALL list the resource under its teaching role
- **AND** every launchable type SHALL expose a safe launch target owned by the live registry index or an existing launcher

#### Scenario: Orphan resource exists
- **WHEN** a resource row has no binding, or every binding target is missing from the current graph
- **THEN** the resource package SHALL fail closed

#### Scenario: Projected type has no launch mapping
- **WHEN** a bound resource of a projected type reaches launch-target resolution
- **THEN** the resolver SHALL map it to an existing route, an existing launcher contract, or an explicit viewer-shell target
- **AND** it SHALL NOT mark the resource available while its launch target is null, and SHALL NOT invent a route from the Canonical Object identity

## ADDED Requirements

### Requirement: Launch hrefs are owned by the live registry index and revision-aligned
Every href the inspector exposes as available MUST be exactly owned by a live registry index entry through its launcherRef, registryId, or sourceRef. Path-shape allowlists SHALL NOT satisfy ownership. Textbook reader hrefs MUST be registered as live index entries generated from the active Teaching Projection launch map. The Teaching Projection manifest authoringRevision MUST equal the deployed application capture revision; the publication assertion MUST read authoringRevision from the candidate source revision and the capture revision from the deployment target application, not from the operator working tree. A `-dirty` capture MUST NOT satisfy the assertion. Publication of a Teaching Projection whose authoringRevision disagrees with the deployment capture revision MUST fail closed before the manifest is served.

#### Scenario: Launch href is held by the live index
- **WHEN** the launch-target map emits an href for a bound resource
- **THEN** a live registry index entry SHALL hold that exact href via launcherRef, registryId, or sourceRef
- **AND** the registry-closure gate SHALL keep the resource block available for that item

#### Scenario: Launch href is not held by the live index
- **WHEN** an emitted href matches no live registry index entry
- **THEN** the registry-closure gate SHALL strip that item's launch
- **AND** the discrepancy SHALL surface as a registration gap rather than a runtime fallback

#### Scenario: Textbook reader href is registered from the teaching projection
- **WHEN** the active Teaching Projection launch map emits a textbook-section reader href
- **THEN** `getTeachingLaunchRouteRecords` SHALL register that exact href as a live index entry
- **AND** `indexOwnsLaunchHref` SHALL return true only because an entry holds that href, not because the path matches a textbook route pattern

#### Scenario: Manifest revision disagrees with deployment
- **WHEN** `deploy:runtime` resumes a published release or builds a fresh release
- **THEN** it SHALL assert the candidate source revision's Teaching Projection authoringRevision against the deployed application's `/app/.app-revision`
- **AND** a mismatch, a missing candidate pointer, or a `-dirty` capture SHALL fail the release closed before the release is served

#### Scenario: Live registry index follows a teaching projection switch
- **WHEN** the active Teaching Projection pointer identity changes without an application restart
- **THEN** the next live registry index read SHALL rebuild from that pointer
- **AND** it SHALL NOT reuse a memoized index captured under a previous projection identity

### Requirement: Viewer-shell bindings carry the selected resource payload
Each available viewer-shell binding MUST carry learner-safe content for that resource. Card bindings MUST include that card's published summary; infographic bindings MUST include a published image URL that identifies that infographic without `act:` resource ids, canonical ids, or source paths. A viewer-shell binding whose published payload cannot be resolved MUST be unavailable.

#### Scenario: Multiple cards or infographics are bound to one node
- **WHEN** a learner selects one of several card or infographic bindings on the same node
- **THEN** the viewer SHALL render that binding's payload
- **AND** the payload SHALL be resolved from that resource's runtime card or infograph file, not from the node's one-slot learning-content record
- **AND** it SHALL NOT substitute another binding's content, the node's default card, or an empty placeholder while remaining available
