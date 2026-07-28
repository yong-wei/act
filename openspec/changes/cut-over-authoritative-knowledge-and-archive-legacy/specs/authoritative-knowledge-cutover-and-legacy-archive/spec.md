## ADDED Requirements

### Requirement: Cutover waits for every formal consumer
Production authority MUST remain Legacy until standard Bundle compatibility, candidate import, accepted ReleaseSet Delta, coverage/resource governance, graph APIs, Konling knowledge search, RAG, SAR, KAQ, effective resources, CourseCoverage, learning paths, and Canonical fact writers all pass their migration gates against a complete accepted course ReleaseSet and formal Teaching Projection. An engineering-only ReleaseSet MUST NOT satisfy the complete-course gate.

#### Scenario: One consumer remains Legacy-bound
- **WHEN** any required consumer or effective resource lacks verified Canonical support
- **THEN** the system SHALL block production authority cutover

#### Scenario: Engineering-only ReleaseSet is the latest accepted candidate
- **WHEN** the latest accepted candidate lacks a complete course ReleaseSet or formal Teaching Projection
- **THEN** the system SHALL keep production authority on Legacy

### Requirement: Latest production data is rehearsed locally
Before production deployment, the operator MUST export the latest production database, restore it in a controlled local environment, and execute the exact intended application revision, schema, ReleaseSet, Overlay, migration, and smoke checks.

#### Scenario: Synthetic tests pass but production rehearsal is absent
- **WHEN** only fixtures or an older database have been migrated
- **THEN** production cutover SHALL remain blocked

#### Scenario: Local production-data rehearsal succeeds
- **WHEN** migration, all consumers, Legacy Archive, and Canonical writer shadow validation pass on the latest export
- **THEN** the system SHALL produce an auditable rehearsal receipt for the production window

### Requirement: Production cutover occurs under downtime
The operator MUST stop the application, worker, and scheduler, back up the database, execute the rehearsed migration, and transactionally switch the active ReleaseSet together with resource, RAG, KAQ, SAR, path, and Canonical fact-writer authority selectors before reopening service.

#### Scenario: Production smoke checks fail before reopening
- **WHEN** any required smoke check fails and no Canonical facts have been accepted
- **THEN** the operator SHALL keep service stopped and MAY restore the backed-up database and old application

#### Scenario: Production smoke checks pass
- **WHEN** all required read and write boundary checks pass
- **THEN** the operator MAY reopen application, worker, and scheduler

#### Scenario: Any formal consumer selector remains Legacy
- **WHEN** the transaction cannot activate every required Canonical selector together
- **THEN** the cutover SHALL roll back before service reopening rather than allowing a partial production switch

### Requirement: Legacy Archive is fixed, read-only, and permission preserving
The system SHALL preserve a fixed snapshot of Legacy nodes, relations, knowledge revisions, unfinished paths, and node notes in an independent archive.

#### Scenario: Teacher or student opens the archive
- **WHEN** the user had access to the corresponding old graph content
- **THEN** the archive SHALL permit the same content visibility without edit or business actions

#### Scenario: Personal note is requested
- **WHEN** a Legacy node note is read
- **THEN** only its owner SHALL see the note, while an authorized administrator MAY access audit metadata according to existing governance

#### Scenario: Archive content is used by a formal consumer
- **WHEN** Konling, recommendation, path, resource, or fact code attempts to query the archive
- **THEN** the request SHALL be rejected because the archive has no business-runtime contract

### Requirement: Legacy business runtime retires after cutover
After successful cutover, the main graph MUST remove the old-version toggle and the system MUST retire legacy graph DTOs, business APIs, and formal runtime reads.

#### Scenario: User needs historical context
- **WHEN** the user follows a permitted historical link
- **THEN** the system SHALL open the independent Legacy Archive rather than the main graph or old business API

### Requirement: Rollback closes when Canonical facts begin
Once reopened service accepts a Canonical learning fact, Legacy knowledge MUST NOT be restored as active production authority.

#### Scenario: Post-reopen defect occurs
- **WHEN** a defect is discovered after Canonical facts have been written
- **THEN** the operator SHALL stop service and apply a forward repair without dual writing, reverse mapping, or silent Legacy fallback
