# authority-surface-complete-linkage Specification

## Purpose
TBD - created by archiving change bind-authority-cards-infographs-and-resources-without-orphans. Update Purpose after archive.
## Requirements
### Requirement: Inspector teaching identity is singular
Active node-detail, learning-content resolution, and system-resource binding SHALL consume the same Teaching Projection identity as the Authority shard envelope. A second `projection/current.json` pointer with a different `projectionId` MUST NOT be used to authorize or reject inspector media.

#### Scenario: Domain-fragments overlay is the workspace teaching identity
- **WHEN** the selected node's shard envelope reports a passed teaching overlay
- **THEN** card, infograph and resource resolvers SHALL use that envelope's `projectionId` and `projectionHash`
- **AND** they SHALL NOT fail solely because a course-level teaching pointer has another projection id

#### Scenario: Two teaching pointers disagree
- **WHEN** `knowledge/projection/current.json` and the shard envelope teaching overlay declare different projection ids
- **THEN** the inspector SHALL treat the course-level pointer as stale for this surface
- **AND** it SHALL NOT show 「当前系统资源与所选对象身份不一致」 as the default for every node

### Requirement: Every knowledge card and infograph is linked
Every runtime Authority card file and every runtime Authority infograph file MUST appear in the v2 learning-content manifest with exactly one current graph object id. The manifest MUST be produced by the scripted v2 export, which MUST stamp `teachingProjectionId` and `teachingProjectionHash` from the active domain-fragments overlay `current.json`; hand-edited manifest fields MUST NOT pass the linkage gate. A card without a matching infograph MUST be recorded with infograph state `missing`; an infograph without a card, a duplicate identity, an unmapped canonical id, a hash drift, or an empty runtime card set MUST fail the export. Publication MUST fail closed if any card or infograph is missing from the manifest, duplicate-mapped, hash-drifted, or unmapped. Quality-accepted cards MUST render in the matching node's inspector. Draft-blocked cards MUST remain in the ledger and MUST NOT render as reviewed knowledge.

#### Scenario: Quality card matches a graph node
- **WHEN** an `ok` Authority card file hashes to its manifest row and `authority_entity_id` equals a current node id
- **THEN** selecting that node SHALL render the card in the inspector
- **AND** the node-detail response SHALL NOT omit the card solely because a legacy cards-index row is absent

#### Scenario: Any card or infograph is unlinked
- **WHEN** a card or infograph file has no valid v2 manifest row, a broken hash, or a canonical id absent from the current graph
- **THEN** the learning-content package SHALL fail closed
- **AND** it SHALL NOT be marked ready

#### Scenario: Manifest teaching seal is produced by script
- **WHEN** the scripted v2 export runs against the runtime card and infograph set
- **THEN** the emitted manifest SHALL carry `teachingProjectionId` and `teachingProjectionHash` equal to the active overlay `current.json`
- **AND** the linkage gate SHALL fail closed when the seal is absent, stale, or hand-edited to another value

#### Scenario: Card has no infograph
- **WHEN** a runtime card file has no infograph of the same safe id
- **THEN** the export SHALL record its infograph state as `missing` with a null hash
- **AND** the export SHALL still fail closed for an infograph file that has no card and for an empty runtime card directory

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

### Requirement: Product linkage uses the runtime card and resource set
Inspector and path-planning completeness for cards, infographs, and system resources MUST be measured against the runtime file set served to learners. The git-tracked one-node v2 fixture remains a CI fail-closed sample and MUST NOT be reported as product coverage.

#### Scenario: Operator inspects teaching-scope nodes
- **WHEN** a teaching-scope overlay core is selected in the knowledge workspace
- **THEN** associated runtime cards and bound system resources SHALL list when their v2/runtime rows bind that core
- **AND** absence of a git-tracked card file SHALL NOT hide a valid runtime card

#### Scenario: Git CI runs on the fixture
- **WHEN** the linkage gate runs in git CI
- **THEN** it SHALL validate only git-tracked v2 rows and sidecar identity
- **AND** it SHALL NOT treat local untracked runtime cards as the committed inventory

### Requirement: Learning-content v2 export runs in the runtime release chain
The runtime content release chain MUST execute the scripted v2 export (scan, seal, and manifest write) and the authority-surface linkage gate before publishing, and MUST include the sealed manifest together with the complete runtime card and infograph file set it references in the published release closure through the external input bundle channel. A release whose learning-content manifest is v1, unsealed, or references assets absent from the release closure MUST fail before activation. The git-tracked one-node fixture MUST NOT be published as the production manifest.

#### Scenario: Release publishes the sealed full manifest
- **WHEN** an operator runs the runtime content release with the complete runtime card and infograph set
- **THEN** the release closure SHALL contain the v2 manifest covering every runtime card and infograph, sealed to the active overlay teaching identity
- **AND** the linkage gate SHALL pass against the exact bytes staged for release

#### Scenario: Export or linkage gate fails during release
- **WHEN** the v2 export or the linkage gate fails while a release is being prepared
- **THEN** the release SHALL stop before activation
- **AND** the previously active manifest SHALL keep serving

#### Scenario: Release plan omits the learning-content channel
- **WHEN** a release plan is built without the learning-content external input bundle
- **THEN** the release SHALL fail closed at plan or pre-activation verification
- **AND** it SHALL NOT fall back to the git-tracked fixture manifest

### Requirement: Learning-content readiness is consumer-aligned and fail-closed
Learning-content readiness classification MUST report `available` only when the served manifest uses the v2 contract, its authority identity four-tuple equals the active Authority release, and its teaching seal, when present, equals the served overlay envelope. V1 or aliased contracts MUST classify as `version-drift`, malformed or duplicate manifests as `unavailable`, and authority-identity mismatches as `identity-mismatch`; none of these SHALL be reported ready. The consumer resolver MUST fail closed on the same contract, authority identity, and teaching seal before reading any card or infograph bytes.

#### Scenario: Triple match marks the surface ready
- **WHEN** the served v2 manifest, the active Authority release identity, and the overlay teaching envelope all agree
- **THEN** readiness SHALL classify the learning-content surface as `available`
- **AND** the consumer resolver SHALL serve the matching node's card and infograph

#### Scenario: Any leg of the triple disagrees
- **WHEN** the manifest contract is v1 or aliased, or the authority identity four-tuple differs, or the teaching seal differs from the served envelope
- **THEN** readiness SHALL classify the surface as `version-drift` or `identity-mismatch` and SHALL NOT report `available`
- **AND** the consumer resolver SHALL return the unavailable state without reading card or infograph bytes

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
- **AND** the memo key and teaching launch route records SHALL read the same configured Teaching Projection store root

### Requirement: Viewer-shell bindings carry the selected resource payload
Each available viewer-shell binding MUST carry learner-safe content for that resource. Card bindings MUST include that card's published summary; infographic bindings MUST include a published image URL that identifies that infographic without `act:` resource ids, canonical ids, or source paths. A viewer-shell binding whose published payload cannot be resolved MUST be unavailable.

#### Scenario: Multiple cards or infographics are bound to one node
- **WHEN** a learner selects one of several card or infographic bindings on the same node
- **THEN** the viewer SHALL render that binding's payload
- **AND** the payload SHALL be resolved from that resource's runtime card or infograph file, not from the node's one-slot learning-content record
- **AND** it SHALL NOT substitute another binding's content, the node's default card, or an empty placeholder while remaining available

#### Scenario: Viewer-shell bindings remain available without a page href
- **WHEN** a viewer-shell binding carries that resource's published payload and its launch href is null
- **THEN** the knowledge node-detail sanitizer SHALL keep the binding available
- **AND** it SHALL NOT rewrite availability solely because a missing href fails public launch sanitization

