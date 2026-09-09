## MODIFIED Requirements

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

## ADDED Requirements

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
