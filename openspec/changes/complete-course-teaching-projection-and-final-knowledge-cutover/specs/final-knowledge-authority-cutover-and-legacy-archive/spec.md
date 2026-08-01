## ADDED Requirements

### Requirement: Final gate uses independently reviewed current CourseCoverage

The final gate MUST require an independent item-level decision for all 3,609 records in the current CourseCoverage worklist. Each decision MUST bind the current worklist input digest, Release, accepted Delta, authoring revision, source evidence, and reviewer identity. The 1,772 profile-only records MUST remain unresolved until independent evidence review supplies the missing basis. A historical Coverage verdict MUST NOT satisfy the current gate.

#### Scenario: Complete current worklist is independently reviewed

- **WHEN** all 3,609 records have decisions bound to the current worklist and Release/Delta digests
- **THEN** the final gate MAY accept CourseCoverage as a cutover input

#### Scenario: Profile-only item lacks current evidence

- **WHEN** one of the 1,772 profile-only records has no independent decision for the current digest
- **THEN** the final gate SHALL remain blocked and SHALL not emit accepted CourseCoverage

#### Scenario: Only an old verdict is available

- **WHEN** a historical verdict covers the same canonical ID but references another worklist or Release
- **THEN** it SHALL remain historical evidence and SHALL not be copied into the current authority

### Requirement: Role Mapping uses explicit capability contracts and alternatives

The nine-role Mapping MUST classify each role under its declared contract and retain independent `Primary` and `Challenger` review decisions with candidate rationale. When those decisions disagree, an independent `Third` adjudicator MUST record the terminal decision. The role “仿真验证与跨模型比较” MUST use an activity/evaluation capability contract, and “现代控制与船海迁移” MUST use a scene-migration capability contract. Neither role MAY be mapped to an approximate Canonical knowledge object.

#### Scenario: Mapping has a defensible primary and challenger

- **WHEN** a role has contract-compatible candidates and reviewer evidence for the primary and challenger
- **THEN** the Mapping SHALL persist both candidates, rationale, and reviewer identities

#### Scenario: Third adjudication is necessary

- **WHEN** Primary and Challenger review decisions disagree
- **THEN** an independent Third adjudicator SHALL record the terminal decision or the Mapping SHALL remain blocked

#### Scenario: Activity or migration role is treated as a knowledge node

- **WHEN** either the activity/evaluation role or scene-migration role is assigned only because a nearby Canonical object looks similar
- **THEN** the Mapping SHALL be rejected and the role contract SHALL remain unresolved

### Requirement: Teaching Projection handoff and attestation are formally versioned

The final gate MUST exchange a versioned Teaching Projection handoff containing the exact frozen ReleaseSet, CourseCoverage, role Mapping, conflict decisions, source evidence, and digests. ACT MUST validate the returned Teaching Projection for schema, membership closure, relation semantics, and digest before an independent attestation records acceptance. Engineering predicates, Coverage roles, or an unreviewed stage snapshot MUST NOT be substituted for formal teaching semantics.

#### Scenario: Valid Teaching Projection is attested

- **WHEN** the handoff identities match and the returned Projection passes schema, membership, relation, and digest validation
- **THEN** an independent attestation SHALL bind the Projection to the handoff and unblock final consumer readiness

#### Scenario: Projection is missing or conflicts with KAQ relations

- **WHEN** required teaching semantics are absent or conflict decisions are not recorded
- **THEN** the handoff SHALL remain blocked and no consumer selector SHALL change

### Requirement: All formal consumers and Canonical writers switch atomically

Graph, Konling, RAG, SAR, KAQ, effective resources, CourseCoverage, path planning, and Canonical learning-fact writers MUST each provide a readiness receipt for the same ReleaseSet, Projection, Mapping, and digest. A single transaction MUST activate every selector and Canonical writer fence together; partial activation or a Legacy selector MUST abort before service reopens.

#### Scenario: Every consumer is ready on one identity

- **WHEN** all readiness receipts match the final handoff and no selector is Legacy-bound
- **THEN** the transaction SHALL activate all consumers and writers together

#### Scenario: One consumer remains Legacy-bound

- **WHEN** any required receipt is missing, mismatched, or still selects Legacy
- **THEN** the transaction SHALL fail closed without changing any selector

### Requirement: Final cutover is rehearsed on the latest production data

Before downtime, the operator MUST re-resolve the latest eligible Release, export the latest production database, restore it in an isolated environment, and run the exact application revision, schema migration, ReleaseSet, Projection, and smoke sequence. The rehearsal receipt MUST record identities, hashes, row counts, duration, failures, and rollback timing; a #1117 stage snapshot alone MUST NOT satisfy this gate.

#### Scenario: Rehearsal matches the final handoff

- **WHEN** the latest export passes the exact migration, consumer, permission, archive, and writer-boundary smoke suite
- **THEN** the operator MAY schedule the bounded production downtime window

#### Scenario: Only synthetic or stale data is rehearsed

- **WHEN** no latest-production export is restored with the final identities
- **THEN** production cutover SHALL remain blocked

### Requirement: Downtime and rollback obey the Canonical write boundary

The operator MUST stop application, worker, and scheduler, create a verified database backup, execute the rehearsed migration and authority transaction, and run smoke checks before reopening. If checks fail before any Canonical fact is accepted, service MUST remain stopped and the backup and old application MAY be restored. Once a Canonical fact is accepted, Legacy MUST NOT be restored as active authority; recovery MUST use a stopped-service forward repair with an audit record.

#### Scenario: Smoke checks fail before reopening

- **WHEN** a required check fails and no Canonical fact has been accepted
- **THEN** service SHALL remain stopped and the approved backup rollback path MAY be used

#### Scenario: A post-reopen defect is found

- **WHEN** a Canonical fact has already been accepted
- **THEN** operators SHALL stop service and apply a forward repair without dual writing or Legacy fallback

### Requirement: Legacy Archive is fixed, read-only, and permission preserving

At cutover the system MUST capture a fixed snapshot of Legacy nodes, relations, revisions, unfinished paths, and node notes behind an independent archive contract. The archive MUST preserve existing content visibility, expose note bodies only to their owners, allow governed administrator audit metadata, and reject graph business, AI, recommendation, resource, path, and learning-fact operations.

#### Scenario: Authorized user opens historical content

- **WHEN** a user had access to the corresponding Legacy content before cutover
- **THEN** the archive SHALL expose the same historical content without edit or business actions

#### Scenario: Archive is queried by a formal consumer

- **WHEN** a formal consumer attempts to read the archive as current knowledge
- **THEN** the request SHALL be rejected at the archive contract boundary

### Requirement: Legacy runtime and bound UI state are retired without mapping

After successful cutover, formal runtime readers, Legacy DTOs, business APIs, caches, and the main graph Legacy toggle MUST be retired. Favorites, canvas layouts, and recent visits keyed by Legacy IDs MUST be reset from the active workspace; notes remain only in the archive and MUST NOT be mapped to Canonical IDs.

#### Scenario: Active workspace opens after cutover

- **WHEN** the user opens the main knowledge workspace after the final transaction
- **THEN** the workspace SHALL show only the active authority and SHALL not expose the Legacy switch or Legacy-bound state

#### Scenario: Historical note is opened

- **WHEN** an authorized owner follows a historical note link
- **THEN** the system SHALL open the independent archive without creating a Canonical mapping
