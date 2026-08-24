## ADDED Requirements

### Requirement: OSS textbook storage, admission and activation are distinct states
The system SHALL distinguish a textbook Blob stored in OSS, a logical path declared by an immutable runtime Release, a textbook corpus admitted by resource-set-complete provenance, and a Release selected as active by the host lifecycle. Rollback, retained and candidate Releases SHALL remain attributable to their own identities and SHALL NOT be presented as active merely because their Blobs remain reachable.

#### Scenario: Historical seven-book Release remains rollback
- **WHEN** the lifecycle protects a rollback Release containing more books than the active resource set
- **THEN** inspection SHALL report those books as rollback Release content
- **AND** the active corpus SHALL continue to report only the books admitted and selected by the active Release

#### Scenario: A Blob is shared across Releases
- **WHEN** active and historical Releases reference the same content-addressed Blob
- **THEN** each logical textbook path SHALL retain the admission and activation state of its own Release
- **AND** Blob reuse SHALL NOT merge their resource sets

### Requirement: Runtime Release source proof binds textbook corpus admission
A runtime Release that changes an external textbook corpus SHALL bind the tracked external-input declaration Git object, canonical bundle semantic/wire digests and resource-set-complete provenance through its file source identities and source-provenance proof. Publication preflight SHALL reopen the declaration, bundle, textbook provenance, runtime manifests and hybrid index manifest and SHALL fail before OSS writes when any identity or semantic field diverges. It SHALL compare textbook `authoringSourceRevision` only among provenance, per-book runtime manifests and the hybrid index, while declaration, bundle capture, source proof and Release manifest revisions SHALL be compared within their release/capture identity domain; equality between those domains SHALL NOT be required.

#### Scenario: Textbook bundle and declaration agree
- **WHEN** a candidate Release includes a changed external textbook bundle
- **THEN** every textbook file source SHALL carry the declared external input and bundle identities
- **AND** the source-provenance proof SHALL close over the same immutable file set and Release manifest

#### Scenario: Semantic provenance drifts behind stable file count
- **WHEN** resourceSetId, book IDs, authoring revision, resource-set digest, input digest or generator identity differs while file count remains unchanged
- **THEN** planning and publication SHALL fail before any Blob, receipt or terminal manifest write

### Requirement: Textbook corpus inspection is credential-safe and lifecycle-bound
The system SHALL provide a read-only inspection result for an active, rollback or explicitly supplied candidate Release. It SHALL report the Release identity and lifecycle state, external input identity, provenance generation, admitted resourceSet and book IDs when proved, authoring source revision, input summary and runtime/index consistency. The result SHALL be derived from one verified Release manifest, lifecycle identity and materialized view and SHALL expose no object key, logical or host path, mount path, credential, signed URL or unselected candidate detail.

#### Scenario: Active and rollback corpora are inspected
- **WHEN** active and rollback Releases contain different textbook sets
- **THEN** the result SHALL preserve both Release identities and states without unioning their books
- **AND** exactly one corpus SHALL be reported active

#### Scenario: Lifecycle changes during inspection
- **WHEN** lifecycle generation, manifest identity or materialized receipt changes before inspection completes
- **THEN** inspection SHALL fail without reporting a successful active corpus result

### Requirement: Candidate activation validates every textbook in the candidate Release
Before selecting a candidate textbook corpus, the candidate workflow SHALL validate every candidate book through the structured runtime and textbook reader consumers. For v2, it SHALL enumerate the provenance book IDs and verify the hybrid index exact book set, resourceSetId and `authoringSourceRevision`. For v1, it SHALL enumerate book IDs only from that immutable candidate Release's source-proof-verified catalog and runtime manifest path set, verify the candidate-local hybrid index exact book set, and use the result solely for consumer compatibility without creating resourceSet admission. A single representative book SHALL NOT stand in for either corpus generation, and the active Release or another Release SHALL NOT supply a v1 candidate's book set.

#### Scenario: Every declared book is consumable
- **WHEN** each provenance book has one unique catalog entry, a loadable structured runtime, a readable representative unit and a complete reader projection, and the index identity matches
- **THEN** the textbook corpus consumer smoke MAY pass and selection MAY continue through existing lifecycle gates

#### Scenario: One declared book is broken
- **WHEN** any declared book is absent, ambiguous, unreadable or inconsistent with the hybrid index
- **THEN** candidate activation SHALL fail before active selection
- **AND** the prior active and rollback identities SHALL remain unchanged

#### Scenario: An unchanged v1 bundle is inherited by a new runtime Release
- **WHEN** an unrelated runtime change inherits an exact frozen v1 external textbook bundle
- **THEN** activation SHALL enumerate and smoke every book from the candidate Release's own verified catalog/runtime manifests
- **AND** it SHALL NOT require or synthesize v2 resourceSet admission

#### Scenario: A seven-book v1 rollback is selected again
- **WHEN** lifecycle selection targets an immutable seven-book rollback Release while the current active Release contains two books
- **THEN** smoke SHALL validate the rollback Release's seven-book candidate-local set
- **AND** it SHALL NOT union, replace or infer that set from the active Release

#### Scenario: A non-first legacy book is broken
- **WHEN** any v1 candidate book after the first catalog entry fails runtime, reader or index validation
- **THEN** selection SHALL fail closed
- **AND** the existing active and rollback identities SHALL remain unchanged
