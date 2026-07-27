# authoritative-knowledge-release-ingestion Specification

## Purpose
TBD - created by archiving change ingest-authoritative-actkg-releases. Update Purpose after archive.
## Requirements
### Requirement: Explicit ReleaseSet lock governs admissible packages
The system MUST ingest ActKG Engineering Releases only when their release identity, version, controlled repository path, Schema contract hash, and release hash exactly match an explicitly reviewed ReleaseSet lock entry.

#### Scenario: Locked package is admitted
- **WHEN** the current root-locus package matches every field in its lock entry
- **THEN** the system SHALL admit it to transactional validation

#### Scenario: Unlocked or drifted package is rejected
- **WHEN** a package is discovered by directory scan, claims to be latest, or differs from its lock entry
- **THEN** the system SHALL reject it without changing the candidate ReleaseSet

### Requirement: Current release contract is validated without future abstraction
The system MUST validate `root-locus-engineering-v0.1` against its pinned current Schema and `contract_hash`, and MUST NOT claim compatibility with an unknown future Schema.

#### Scenario: Current contract passes
- **WHEN** the package validates against the pinned current Schema and contract hash
- **THEN** the system SHALL continue with semantic and referential validation

#### Scenario: New contract arrives
- **WHEN** a later package carries an unadapted Schema or contract hash
- **THEN** the system SHALL block ingest until a reviewed compatibility change and tests are supplied

### Requirement: Authoritative payload is stored losslessly
The system SHALL persist a relational envelope for stable identities and query fields, the complete Schema-validated object and relation payloads in JSONB, and the original normalized Release with its hash.

#### Scenario: Heterogeneous objects are imported
- **WHEN** a Release contains DomainConcept, Formula, KnowledgeStatement, SystemModel, or another current-Schema-valid type
- **THEN** the system SHALL preserve its canonical type and every type-specific field without coercing it to a legacy node kind

#### Scenario: Round-trip verification runs
- **WHEN** an imported Release is reconstructed from persisted data
- **THEN** its normalized authoritative content and hash SHALL equal the locked package

### Requirement: Release membership follows the release envelope
The system MUST treat `release_status=RELEASED` together with the Release entity lists as the membership authority.

#### Scenario: Frozen unpublished field is present
- **WHEN** a listed canonical object retains `publication_status=unpublished` from its pre-Release frozen state
- **THEN** the system SHALL import it as a member and preserve the field without filtering the object

### Requirement: ReleaseSet import is atomic and conflict closed
The system MUST import a ReleaseSet in one transaction and fail the entire ingest on missing endpoints, invalid references, inconsistent duplicate identities, undeclared revisions, or hash failures.

#### Scenario: Referenced endpoint is absent
- **WHEN** any authoritative relation references an object outside the valid ReleaseSet
- **THEN** no object, relation, source mapping, or evidence row from that ingest SHALL become visible

#### Scenario: Idempotent re-import occurs
- **WHEN** the same locked package is imported again
- **THEN** the system SHALL preserve one semantically identical candidate version without duplicate authoritative rows

### Requirement: Ingest does not activate production authority
The system MUST store the first package as candidate data only.

#### Scenario: Candidate import completes
- **WHEN** all ingest gates pass
- **THEN** existing graph APIs, RAG, SAR, KAQ, resources, paths, and learning-fact writers SHALL continue using the legacy production authority

### Requirement: Release lineage reflects the accepted package without fabrication
The system MUST store every upstream lineage field carried by an accepted Engineering Release and MUST represent missing lineage fields explicitly rather than infer or fabricate them.

#### Scenario: Current root-locus package is imported
- **WHEN** ACT imports `root-locus-engineering-v0.1`
- **THEN** the receipt SHALL preserve its source run and source implementation commit, mark CTKGDataset hash, publication identity, and resolvable location as unavailable, and SHALL NOT reject the package solely because those later lineage fields are absent

#### Scenario: Importer attempts to reconstruct missing lineage
- **WHEN** a package does not carry a CTKGDataset reference
- **THEN** the importer SHALL reject any inferred hash, publication identity, or location presented as upstream package truth

### Requirement: Revision proposal governance remains upstream
The system SHALL store a RevisionProposalRegistry version and hash only when the accepted Release carries that reference and MUST NOT import proposal details or expose proposal status in ACT runtime interfaces.

#### Scenario: Current Release has no registry reference
- **WHEN** `root-locus-engineering-v0.1` is imported without a RevisionProposalRegistry reference
- **THEN** ACT SHALL mark the reference as unavailable, SHALL NOT fabricate one, and SHALL still accept the otherwise valid locked package

#### Scenario: A future adapted Release carries a registry reference
- **WHEN** a separately adapted Release references a RevisionProposalRegistry
- **THEN** ACT SHALL preserve its version and hash for audit while leaving proposal review and progress in ActKG

### Requirement: Authoritative engineering content is read-only in ACT
ACT MUST NOT provide mutation, feedback, cross-project submission, or automatic revision endpoints for Canonical Objects or engineering relations.

#### Scenario: Runtime user attempts authoritative revision
- **WHEN** any ACT role attempts to edit a Canonical Object, relation, or submit a governance correction
- **THEN** the system SHALL reject the operation and preserve the imported Release unchanged

