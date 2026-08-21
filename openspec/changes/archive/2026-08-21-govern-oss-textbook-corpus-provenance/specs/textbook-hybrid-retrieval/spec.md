## ADDED Requirements

### Requirement: Hybrid retrieval closes over the admitted textbook corpus
The hybrid retrieval manifest SHALL bind the same resourceSetId, normalized book IDs and authoring source revision as the textbook corpus admission provenance. Its manifest identity and every per-book runtime manifest identity SHALL be verified before the external bundle is accepted. Equal book counts, shared Blob objects or a historical index SHALL NOT establish corpus consistency.

#### Scenario: Runtime and index describe the same corpus
- **WHEN** external bundle preflight validates a resource-set-complete textbook corpus
- **THEN** the hybrid index book IDs SHALL equal the provenance book IDs exactly
- **AND** its resourceSetId and authoring source revision SHALL equal the provenance and every runtime book manifest

#### Scenario: Same-count index drift occurs
- **WHEN** the hybrid index contains the same number of books but at least one book ID differs from provenance
- **THEN** bundle preparation, publication and candidate activation SHALL fail closed

#### Scenario: Historical index is present in OSS
- **WHEN** a retained or rollback Release contains a valid historical index for a different book set
- **THEN** that index SHALL remain attributable only to its immutable Release
- **AND** its OSS reachability SHALL NOT qualify it as the active corpus index
