## MODIFIED Requirements

### Requirement: Shards use one composite version envelope
Every learner shard MUST bind the active Authority selection and reviewed domain catalog version and MUST bind the exact course active-domain scope plus ACT relation projection ID/hash when teaching data is present. The client MUST reject a shard whose required identities do not match its established root envelope. A teaching-bearing cache entry SHALL be isolated from compatible Engineering-only cache entries so a relation projection change does not force unrelated Engineering data to be discarded.

#### Scenario: Teaching Projection advances independently
- **WHEN** Authority and catalog identities are unchanged but the exact matching ACT relation projection or scope identity changes
- **THEN** teaching-bearing shard cache entries SHALL invalidate and reload under the new composite identity
- **AND** compatible Engineering-only shard cache entries MAY remain valid

#### Scenario: Authority identity changes
- **WHEN** the active Authority selection changes
- **THEN** all root, domain, family, neighborhood and detail shards from the prior Authority SHALL be rejected or invalidated

#### Scenario: Old or mismatched projection is available
- **WHEN** a Teaching Projection does not match the active Authority envelope, course, or active-domain scope hash
- **THEN** the shard SHALL omit all relations from that projection
- **AND** it SHALL not merge, adapt, relabel, or fall back to the mismatched projection

### Requirement: Optional teaching failure does not block engineering shards
The domain shard service SHALL return available Engineering objects and requested Engineering relations when the optional teaching layer is partial, empty, unavailable, or identity-mismatched. A matching teaching-bearing shard SHALL return only admitted published containment, prerequisite, and pedagogical-association edges. Public runtime responses SHALL NOT expose relation candidates, review-pack identity, confidence, reviewer, decisions, pending counts, internal `PARTIAL` governance state, or review actions and SHALL NOT manufacture teaching edges or complete-coverage claims.

#### Scenario: Matching partial projection is active
- **WHEN** a matching formal `PARTIAL` relation projection is selected for the domain
- **THEN** the shard SHALL return only its admitted published containment, prerequisite, and association edges
- **AND** it SHALL expose no internal partial, pending, candidate, review, confidence, or decision metadata

#### Scenario: Domain has no published teaching relation
- **WHEN** Authority and catalog are valid but no exact matching teaching relation projection is available
- **THEN** primary domain objects and requested Engineering families SHALL remain available
- **AND** the response SHALL not fabricate empty-complete coverage, substitute Engineering edges, or expose a runtime audit control

## ADDED Requirements

### Requirement: Cross-domain teaching endpoints remain real bounded relations
A published teaching relation whose adjacent endpoint belongs to another selected domain SHALL preserve both real Canonical endpoints and exact relation meaning. The active-domain shard MAY represent the remote endpoint as a bounded boundary-navigation descriptor until explicit traversal, but MUST NOT replace it with a domain catalog root, inferred recommendation, or presentation proxy identity.

#### Scenario: Published relation crosses a domain boundary
- **WHEN** a matching teaching relation connects the active domain to a Canonical Object in another selected domain
- **THEN** the shard SHALL preserve the real remote endpoint identity internally and project a safe human-readable target-domain entrance
- **AND** it SHALL not fetch the target domain's full shard or substitute its circular root navigation entry

#### Scenario: Viewer follows the boundary entrance
- **WHEN** the viewer explicitly follows an authorized cross-domain teaching relation
- **THEN** the client SHALL load the bounded target-domain shard under the same composite envelope and focus the real adjacent object
- **AND** no new relation or target identity SHALL be inferred during navigation
