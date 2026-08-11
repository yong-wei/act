# authoritative-knowledge-release-ingestion Specification

## Purpose
TBD - created by archiving change ingest-authoritative-actkg-releases. Update Purpose after archive.
## Requirements
### Requirement: Explicit ReleaseSet lock governs admissible packages
The system MUST validate a standard ActKG public Bundle only when its controlled repository path, Bundle identity/revision/digest, Release identity/hash, Schema version/raw hash, Manifest raw hash, and required public contract identities exactly match an explicitly reviewed ReleaseSet Lock v3 entry. Already accepted no-Manifest historical packages MUST retain their frozen exact lock and adapter and MUST NOT be rewritten as Lock v3 Bundles.

#### Scenario: Locked package is admitted
- **WHEN** a standard Bundle and every declared identity and hash match the current Lock v3 entry
- **THEN** the system SHALL admit it to compatibility and integrity validation

#### Scenario: Unlocked or drifted package is rejected
- **WHEN** a package is discovered by directory scan, selected by latest/max-version logic, supplied as a candidate without an explicit development flag, or differs from its lock
- **THEN** the system SHALL reject it without changing any candidate or production selector

#### Scenario: Completed v0.2 package remains frozen
- **WHEN** the #1125 no-Manifest package is read or regression-tested after Lock v3 is introduced
- **THEN** the system SHALL use its existing exact lock and adapter without fabricating a Manifest or rewriting its accepted receipt

### Requirement: Authoritative payload is stored losslessly
The system SHALL persist every byte of the locked public Engineering Release bundle with its relative path and hash, relational envelopes for stable identities and query fields, and the complete Schema-validated public release, projection, component, and crosswalk payloads without fabricating private CTKGDataset content.

#### Scenario: Heterogeneous objects are imported
- **WHEN** the locked bundle contains DomainConcept, Formula, KnowledgeStatement, SystemModel, ModelRepresentation, or another current-Schema-valid projected type
- **THEN** the system SHALL preserve each projected `entity_type` and every type-specific payload field without coercing any object to a legacy node kind

#### Scenario: Public aggregate bundle is imported
- **WHEN** the locked bundle contains release JSON, GraphProjection V2, RAG crosswalk JSONL, component manifest, `SHA256SUMS`, and release notes
- **THEN** the system SHALL preserve every public artifact and all current-contract fields with their original identities and hashes

#### Scenario: Round-trip verification runs
- **WHEN** an imported bundle is reconstructed from persisted artifacts
- **THEN** every reconstructed public artifact SHALL match its locked original bytes and SHA-256

#### Scenario: Private dataset is absent
- **WHEN** the public bundle does not carry the private CTKGDataset
- **THEN** the system SHALL record that boundary explicitly and SHALL NOT present projection nodes or retrieval identifiers as a reconstructed private dataset

### Requirement: Release membership follows the release envelope
The system MUST treat the aggregate release `entries` and `included_entities` together with the locked release and projection identities as the public membership authority.

#### Scenario: Frozen unpublished field is present
- **WHEN** a listed canonical object retains `publication_status=unpublished` from its pre-Release frozen state
- **THEN** the exact historical adapter SHALL import it as a member of its historical ReleaseSet and preserve the field without filtering the object

#### Scenario: Matching aggregate membership is present
- **WHEN** release entries and included entities form the same unique set and the projection is closed over its declared source release
- **THEN** the system SHALL admit the entries while preserving their public projection and component provenance

#### Scenario: Membership diverges
- **WHEN** entries, included entities, projection endpoints, or the source release identity disagree
- **THEN** the system SHALL reject the complete ingest

### Requirement: ReleaseSet import is atomic and conflict closed
The system MUST import the aggregate ReleaseSet in one transaction and fail the entire ingest on checksum failure, component inconsistency, missing projection endpoints, malformed or duplicate crosswalk triples, crosswalk published entities outside aggregate membership, inconsistent duplicate identities, undeclared revisions, or hash failures. Retrieval chunk and citation target identifiers that the public bundle declares only as opaque strings MUST NOT be required to resolve to package-internal entities or ACT structural units during this change. Standard ReleaseSet import MUST stage a complete immutable Authority Snapshot and MUST NOT replace the current Authority pointer. A separate explicit activation transaction MAY replace that pointer only after round-trip, identity, endpoint, count, and deterministic-hash checks pass. Import and activation MUST NOT consult CourseCoverage or activate teaching consumers.

#### Scenario: Referenced endpoint is absent
- **WHEN** any authoritative relation references an object outside the valid ReleaseSet
- **THEN** no object, relation, source mapping, or evidence row from that ingest SHALL become visible

#### Scenario: Any resolvable bundle reference is invalid
- **WHEN** a component, relation endpoint, release entry, or crosswalk published entity fails the pinned closure rules, or a crosswalk triple is malformed or duplicated
- **THEN** no artifact, object, relation, crosswalk, component, or receipt from that ingest SHALL become visible

#### Scenario: Opaque retrieval identifiers are imported
- **WHEN** valid crosswalk rows contain non-empty `retrieval_chunk_id` and `citation_target_id` values with no corresponding public package entities
- **THEN** the system SHALL preserve those values unchanged and SHALL defer ACT structural-unit resolution to aggregate course and resource governance

#### Scenario: Idempotent re-import occurs
- **WHEN** the same locked aggregate bundle is imported again
- **THEN** the system SHALL preserve one semantically identical candidate version and receipt without duplicate authoritative rows

#### Scenario: Valid stable Release is imported
- **WHEN** a locked Bundle passes compatibility and lossless round-trip checks
- **THEN** a complete staged Authority Snapshot SHALL be written
- **AND** the current pointer SHALL remain unchanged after import until a separate explicit activation succeeds

#### Scenario: Import validation fails
- **WHEN** any required identity, hash, relation endpoint, schema, or serialization check fails
- **THEN** staging SHALL be discarded or marked rejected
- **AND** the current pointer and all teaching selectors SHALL remain unchanged

### Requirement: Ingest does not activate production authority
The system MUST store the aggregate package as candidate data only.

#### Scenario: Candidate import completes
- **WHEN** all CTKG 0.2 ingest gates pass
- **THEN** existing production graph APIs, RAG, SAR, KAQ, resources, paths, and learning-fact writers SHALL continue using the Legacy authority

### Requirement: Release lineage reflects the accepted package without fabrication
The system MUST store the aggregate release, source dataset, projection, component-release, artifact, and upstream revision identities carried by the accepted bundle and MUST represent unavailable private lineage explicitly rather than infer it.

#### Scenario: Current root-locus package is imported
- **WHEN** ACT imports `root-locus-engineering-v0.1`
- **THEN** the receipt SHALL preserve its source run and source implementation commit, mark CTKGDataset hash, publication identity, and resolvable location as unavailable, and SHALL NOT reject the package solely because those later lineage fields are absent

#### Scenario: Aggregate package is imported
- **WHEN** ACT imports `control-theory-engineering-v0.2`
- **THEN** the receipt SHALL bind the release hash, source dataset hash, projection digest, component identities, pinned ActKG consumer-contract commit, artifact hashes, and ACT capture revision

#### Scenario: Importer attempts to reconstruct missing lineage
- **WHEN** the public package omits a private dataset location or governance registry reference
- **THEN** the importer SHALL reject any inferred value presented as upstream package truth

### Requirement: Revision proposal governance remains upstream
The system SHALL store a RevisionProposalRegistry version and hash only when the accepted public bundle carries that reference and MUST NOT import proposal details or expose proposal status in ACT runtime interfaces.

#### Scenario: Current Release has no registry reference
- **WHEN** `control-theory-engineering-v0.2` carries no RevisionProposalRegistry reference
- **THEN** ACT SHALL mark the reference as unavailable, SHALL NOT fabricate one, and SHALL still accept the otherwise valid locked bundle

#### Scenario: A future adapted Release carries a registry reference
- **WHEN** a separately adapted release references a RevisionProposalRegistry
- **THEN** ACT SHALL preserve its version and hash for audit while leaving proposal review and progress in ActKG

### Requirement: Authoritative engineering content is read-only in ACT
ACT MUST NOT provide mutation, feedback, cross-project submission, or automatic revision endpoints for Canonical Objects or engineering relations.

#### Scenario: Runtime user attempts authoritative revision
- **WHEN** any ACT role attempts to edit a Canonical Object, relation, or submit a governance correction
- **THEN** the system SHALL reject the operation and preserve the imported Release unchanged

### Requirement: Aggregate component lineage is validated without duplicate membership
The current ReleaseSet MUST contain only `control-theory-engineering-v0.2`, while its two declared component releases MUST be verified as immutable lineage inputs and MUST NOT create duplicate current membership rows.

#### Scenario: Component lineage matches
- **WHEN** the release, component manifest, component package identities, and hashes agree
- **THEN** the receipt SHALL preserve both component references under the one aggregate ReleaseSet

#### Scenario: Component is imported as a peer
- **WHEN** an ingest attempts to add either component as a second current ReleaseSet member
- **THEN** the system SHALL reject the ReleaseSet as incorrectly composed

### Requirement: Supported public Bundle contracts are explicitly registered
The system MUST validate a locked public Bundle through an explicitly registered Bundle contract, Schema version/raw-hash identity, and required Artifact contracts. The system MUST accept content-compatible future Releases under those registered identities without version-specific code, and MUST block an unknown required contract or Schema identity pending the corresponding adapter update or Schema review.

#### Scenario: Compatible later Release arrives
- **WHEN** a later Bundle uses registered Bundle, Schema, and required Artifact contracts and passes all integrity gates
- **THEN** the system SHALL validate it through the existing standard adapter without adding a version-specific branch

#### Scenario: Required Artifact contract changes
- **WHEN** a later Bundle declares an unknown required role or contract
- **THEN** the system SHALL return `ADAPTER_UPDATE_REQUIRED` and SHALL NOT emit a validated Bundle

#### Scenario: Schema identity changes
- **WHEN** a later Bundle declares an unregistered Schema version/raw-hash pair
- **THEN** the system SHALL return `SCHEMA_REVIEW_REQUIRED` and SHALL NOT infer compatibility from the version string

### Requirement: Standard candidate import consumes only a validated Bundle
The system MUST import a standard ActKG public Bundle only from one deterministic `ValidatedActKGBundle` emitted by the registered compatibility layer and MUST NOT rediscover files, infer Artifact roles, or reinterpret an unvalidated Manifest during persistence.

#### Scenario: Validated standard Bundle is submitted
- **WHEN** a compatible stable aggregate Bundle passes all compatibility and integrity gates
- **THEN** the candidate importer SHALL consume its validated identities, Artifacts, runtime Projection, components, Crosswalk, Metadata, statistics, and compatibility evidence

#### Scenario: Raw standard directory bypasses validation
- **WHEN** a caller submits a standard Bundle directory or raw Manifest directly to the persistence stage
- **THEN** the importer SHALL reject it without writing candidate data

### Requirement: Bundle and semantic Release persistence are distinct
The system MUST persist Bundle identity and revision, Manifest identity, Artifact metadata and raw bytes separately from the semantic Release, while preserving ReleaseSet, Release, Projection and component references without substituting one identity for another.

#### Scenario: Content Release is imported
- **WHEN** a validated Bundle carries a new Release identity or semantic digest
- **THEN** the system SHALL persist one Bundle Receipt and the exact Release, component, Projection, object, relation, Metadata and Crosswalk records bound to that ReleaseSet

#### Scenario: Packaging revision is imported
- **WHEN** a validated Bundle has a new Bundle revision but the same Release ID/hash, source dataset hash and semantic Artifact digests
- **THEN** the system SHALL persist the new Bundle Receipt and raw Artifact versions without duplicating semantic object, relation or Crosswalk rows

### Requirement: Standard candidate import is atomic and round-trip verified
The system MUST stage all standard Bundle records in one transaction, reconstruct every public Artifact and runtime semantic collection from persisted data, and write an immutable `ACCEPTED_CANDIDATE` receipt only after byte, identity, digest and count equality is proven. The import path MUST also record the exact ReleaseSet/import/Delta/capture identities in the snapshot manifest and MUST expose a typed rejection when those identities drift. A valid import MAY be selected by a subsequent explicit Engineering Authority activation without any course-review receipt.

#### Scenario: Standard import completes
- **WHEN** Stage and Round Trip both match the validated Bundle
- **THEN** one accepted non-production candidate ReleaseSet and its complete receipt SHALL become available for explicit Repository and governance reads

#### Scenario: Stage or Round Trip fails
- **WHEN** any write conflict, missing record, byte difference, identity difference, digest difference or count difference is detected
- **THEN** the transaction SHALL roll back and no partial Bundle, Artifact, Release, Projection, object, relation, Crosswalk or receipt SHALL become visible

#### Scenario: Identical Bundle is imported repeatedly
- **WHEN** the same Bundle digest is imported concurrently or repeatedly
- **THEN** the system SHALL return one semantically identical receipt and SHALL NOT duplicate any persisted row

#### Scenario: No CourseCoverage exists
- **WHEN** the Bundle is valid but ACT has no current Teaching Projection or CourseCoverage rows
- **THEN** the engineering snapshot SHALL remain eligible for activation
- **AND** no CourseCoverage worklist SHALL be synthesized

### Requirement: Standard import preserves completed exact-adapter history
The standard importer MUST preserve the CTKG 0.2 data, exact adapter, raw Artifacts and receipts completed by #1125 and MUST represent fields absent from that historical contract as unavailable rather than fabricate or rewrite them.

#### Scenario: Existing v0.2 candidate is read after migration
- **WHEN** the standard import schema migration has completed
- **THEN** the #1125 candidate SHALL retain its original identities, bytes, counts, receipt and exact-contract behavior

#### Scenario: Historical row lacks a standard Bundle field
- **WHEN** a #1125 row has no Bundle Manifest identity or Artifact role introduced by the standard contract
- **THEN** the system SHALL expose that field as unavailable and SHALL NOT infer it from filenames or later Bundles

### Requirement: Import does not choose production or default candidate authority
Importing a compatible Bundle MUST create only an explicit staged/candidate Authority Snapshot and MUST NOT move the default candidate, Engineering Authority, active or Legacy selector, or start a downstream consumer migration. A separate explicit Authority activation transaction MAY atomically advance `authority/current.json` after the staged snapshot, manifest, and pointer target pass all integrity and deterministic checks; that transaction MUST not activate teaching consumers as a side effect.

#### Scenario: New standard candidate is accepted
- **WHEN** its import receipt, lossless round trip, snapshot manifest, and Delta/capture identities pass
- **THEN** authorized downstream processes MAY address it by exact ReleaseSet/snapshot identity while all default, Engineering Authority, teaching, and Legacy selectors remain unchanged

#### Scenario: Explicit Engineering Authority activation follows import
- **WHEN** a staged snapshot is selected by the dedicated activation operation and its target digest matches the immutable manifest
- **THEN** the operation SHALL atomically replace the Authority current pointer and MAY move Engineering Graph/RAG to that snapshot
- **AND** import and activation SHALL remain separately auditable transactions with no implicit CourseCoverage or teaching migration

#### Scenario: Activation target is incomplete or drifted
- **WHEN** the staged snapshot, target pointer, capture, or manifest digest is missing or mismatched
- **THEN** Authority activation SHALL fail closed
- **AND** the prior Authority/Legacy pointers SHALL remain unchanged

