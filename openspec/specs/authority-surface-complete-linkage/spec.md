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
Every runtime Authority card file and every runtime Authority infograph file MUST appear in the v2 learning-content manifest with exactly one current graph object id. Publication MUST fail closed if any card or infograph is missing, duplicate-mapped, hash-drifted, or unmapped. Quality-accepted cards MUST render in the matching node's inspector. Draft-blocked cards MUST remain in the ledger and MUST NOT render as reviewed knowledge.

#### Scenario: Quality card matches a graph node
- **WHEN** an `ok` Authority card file hashes to its manifest row and `authority_entity_id` equals a current node id
- **THEN** selecting that node SHALL render the card in the inspector
- **AND** the node-detail response SHALL NOT omit the card solely because a legacy cards-index row is absent

#### Scenario: Any card or infograph is unlinked
- **WHEN** a card or infograph file has no valid v2 manifest row, a broken hash, or a canonical id absent from the current graph
- **THEN** the learning-content package SHALL fail closed
- **AND** it SHALL NOT be marked ready

### Requirement: System resources have no orphans
Every resource record in the active Teaching Projection MUST have at least one binding to a current Authority object, a human-readable title, and a launcher-safe descriptor for its type. A resource without a binding, or a binding to a missing object, MUST fail closed. Empty titles MUST NOT be projected as available items.

#### Scenario: Resource is bound to a live node
- **WHEN** a video, audio, card, exercise, lesson, or handout resource has a binding to a current canonical id and a non-empty title
- **THEN** selecting that node SHALL list the resource under its teaching role
- **AND** launchable types SHALL expose a safe href owned by the live registry or an existing launcher

#### Scenario: Orphan resource exists
- **WHEN** a resource row has no binding, or every binding target is missing from the current graph
- **THEN** the resource package SHALL fail closed

