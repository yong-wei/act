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
Every href the inspector exposes as available MUST be exactly owned by a live registry index entry through its launcherRef, registryId, or sourceRef. The Teaching Projection manifest authoringRevision MUST equal the deployed live registry index capture revision; a `-dirty` capture MUST NOT satisfy the assertion. Publication of a Teaching Projection whose authoringRevision disagrees with the deployment capture revision MUST fail closed before the manifest is served.

#### Scenario: Launch href is held by the live index
- **WHEN** the launch-target map emits an href for a bound resource
- **THEN** a live registry index entry SHALL hold that exact href via launcherRef, registryId, or sourceRef
- **AND** the registry-closure gate SHALL keep the resource block available for that item

#### Scenario: Launch href is not held by the live index
- **WHEN** an emitted href matches no live registry index entry
- **THEN** the registry-closure gate SHALL strip that item's launch
- **AND** the discrepancy SHALL surface as a registration gap rather than a runtime fallback

#### Scenario: Manifest revision disagrees with deployment
- **WHEN** a release assertion compares the Teaching Projection manifest authoringRevision with the deployment APP_REVISION capture
- **THEN** a mismatch or a `-dirty` capture SHALL fail the release closed
- **AND** the mismatched manifest SHALL NOT be served to learners
