## MODIFIED Requirements

### Requirement: Explicit ReleaseSet lock governs admissible packages
The system MUST ingest ActKG Engineering Releases only when their release identity, version, controlled repository path, pinned consumer-contract revision and hashes, release hash, projection digest, component manifest, and public-artifact hashes exactly match an explicitly reviewed ReleaseSet lock entry.

#### Scenario: Locked package is admitted
- **WHEN** `control-theory-engineering-v0.2` and every declared public artifact and component reference match the current lock entry
- **THEN** the system SHALL admit the aggregate bundle to transactional validation as the sole current ReleaseSet member

#### Scenario: Unlocked or drifted package is rejected
- **WHEN** a package is discovered by directory scan, claims to be latest, is a component offered as a parallel current member, or differs from the lock
- **THEN** the system SHALL reject it without changing the candidate ReleaseSet

### Requirement: Current release contract is validated without future abstraction
The system MUST validate `control-theory-engineering-v0.2` against the pinned CTKG `0.2.0` consumer contract and exact contract-artifact hashes, MUST retain the CTKG 0.1 adapter only for historical audit and regression, and MUST NOT claim compatibility with an unknown future Schema.

#### Scenario: Current contract passes
- **WHEN** the aggregate bundle validates against the pinned CTKG 0.2 consumer contract and all locked hashes
- **THEN** the system SHALL continue with bundle, semantic, and referential validation

#### Scenario: Historical CTKG 0.1 data is inspected
- **WHEN** an auditor reads an already imported 0.1 ReleaseSet
- **THEN** the system SHALL use the exact 0.1 adapter without admitting it as the current candidate

#### Scenario: New contract arrives
- **WHEN** a later package carries an unadapted Schema version or contract hash
- **THEN** the system SHALL block ingest until a reviewed compatibility change and tests are supplied

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
The system MUST import the aggregate ReleaseSet in one transaction and fail the entire ingest on checksum failure, component inconsistency, missing projection endpoints, malformed or duplicate crosswalk triples, crosswalk published entities outside aggregate membership, inconsistent duplicate identities, undeclared revisions, or hash failures. Retrieval chunk and citation target identifiers that the public bundle declares only as opaque strings MUST NOT be required to resolve to package-internal entities or ACT structural units during this change.

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

## ADDED Requirements

### Requirement: Aggregate component lineage is validated without duplicate membership
The current ReleaseSet MUST contain only `control-theory-engineering-v0.2`, while its two declared component releases MUST be verified as immutable lineage inputs and MUST NOT create duplicate current membership rows.

#### Scenario: Component lineage matches
- **WHEN** the release, component manifest, component package identities, and hashes agree
- **THEN** the receipt SHALL preserve both component references under the one aggregate ReleaseSet

#### Scenario: Component is imported as a peer
- **WHEN** an ingest attempts to add either component as a second current ReleaseSet member
- **THEN** the system SHALL reject the ReleaseSet as incorrectly composed
