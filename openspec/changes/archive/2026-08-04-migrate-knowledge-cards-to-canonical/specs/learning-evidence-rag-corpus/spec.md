## MODIFIED Requirements

### Requirement: Reviewed knowledge visuals expose citation-safe grounding
Card retrieval MUST resolve by Canonical ID and retain card/resource/projection identity, source hash, review state, citation target, and optional-card status. A missing optional card MUST NOT be represented as a missing Canonical node.

#### Scenario: Canonical card is retrieved
- **WHEN** a teaching or Konling query resolves an active card for a Canonical ID
- **THEN** the retrieval record SHALL carry the Canonical ID, card ID, projection ID, and citation-safe provenance

#### Scenario: Card is optional and absent
- **WHEN** no active card exists for an optional Canonical ID
- **THEN** RAG SHALL continue with the Canonical summary or other authorized resource
- **AND** it SHALL report the absence without fabricating card content

### Requirement: Canonical RAG remains shadow before cutover
Card migration MUST not switch formal RAG authority by itself. Until the consumer activation gate passes, card queries SHALL use the explicit Legacy/pinned fallback combination and expose migration/fallback provenance.

#### Scenario: Legacy fallback is used
- **WHEN** a step still resolves through a legacy card crosswalk
- **THEN** RAG SHALL record the fallback hit and legacy identity
- **AND** it SHALL not write a new Canonical authority selector
