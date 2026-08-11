## MODIFIED Requirements

### Requirement: Knowledge cards and infographs are reviewed in semantic shards
Canonical-keyed knowledge cards MUST remain governed teaching resources and MUST carry one Canonical ID, reviewed source/version evidence, citation metadata, and explicit path/grounding disposition. Card migration MUST NOT make a card an engineering graph entity or require one for every Canonical node.

#### Scenario: Core card is active
- **WHEN** a card is selected for a core node with `cardPolicy: REQUIRED`
- **THEN** the card SHALL pass existing semantic/citation review and appear once in the Canonical card index

#### Scenario: Non-core node has no card
- **WHEN** a non-core Canonical node has no active card
- **THEN** the ResourceNode projection SHALL remain valid if other resource evidence is present
- **AND** no card-readiness gate SHALL be synthesized

### Requirement: ResourceNode registry exposes a planner-consumable projection
The ResourceNode projection MUST identify Canonical-keyed card resources, optional-card absence, legacy fallback status, projection identity, source hash, review state, and launch/evidence policy without exposing raw hidden card content.

#### Scenario: Step resolves an optional card
- **WHEN** a step references a Canonical ID whose active card is absent
- **THEN** the projection SHALL return the Canonical/resource identity and an explicit optional-card-missing state
- **AND** path consumers SHALL be able to use other eligible resources

### Requirement: Core registered and knowledge resources have complete reviewed semantics
Only cards required by selected core-node/card-policy records MUST block the corresponding projection. A duplicate, split, or unmapped card MUST retain a machine-readable classification and cannot silently become active.

#### Scenario: Duplicate active cards exist
- **WHEN** two cards claim ACTIVE status for one Canonical ID
- **THEN** card-index publication SHALL fail closed
- **AND** the affected card consumer SHALL remain on its prior valid state
