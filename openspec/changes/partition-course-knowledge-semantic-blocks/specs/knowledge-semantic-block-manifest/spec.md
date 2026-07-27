## ADDED Requirements

### Requirement: Identity components are indivisible and singly owned
Partitioning SHALL consume validated identity-component and domain-candidate manifests, assign every identity equivalence component to exactly one owner block, and reject exact-name or reviewed-alias equivalence that leaks across blocks. Pending splits SHALL remain inside the owning component.

#### Scenario: Partition coverage is validated
- **WHEN** all components are reconciled
- **THEN** each component SHALL appear in exactly one owner block
- **AND** no source item SHALL be unowned, multiply owned, or split across blocks.

### Requirement: Blocks derive from semantic evidence rather than provisional dimensions
Partitioning SHALL use identity semantics, normalized text, and relation connectivity while using the domain-candidate pollution review only to exclude course/module and navigation dimensions. Review-capacity targets MAY guide partitioning but SHALL NOT fix a block count.

#### Scenario: A prior prototype is supplied
- **WHEN** its labels or count conflict with current derivation
- **THEN** the current deterministic derivation SHALL prevail
- **AND** no prototype block SHALL be grandfathered.

### Requirement: Partition output is typed and digest bound
Each block record SHALL identify its owner, typed exact items, `candidate_concept_count`, applicable endpoint blocks, change-ID `blockedBy`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, `schema_version`, `algorithm_version`, `normalization_profile`, scope-anchor evidence, and explicit capacity exceptions. Every owned identity component SHALL contribute card/visual review seed items even when no source card exists. A stage-two split SHALL invalidate the component closure and SHALL regenerate one `canonical_card_review` plus one `visual_suitability_review` exact item for every resulting final canonical concept before readiness can be restored.

#### Scenario: A block manifest is serialized twice
- **WHEN** input order changes but normalized inputs do not
- **THEN** both outputs SHALL be byte-identical.

#### Scenario: A component has no source knowledge card
- **WHEN** exact items are generated
- **THEN** missing-card and visual-suitability review records SHALL still be present
- **AND** exact closure SHALL fail if either record is omitted.

#### Scenario: A pending component is split into several canonical concepts
- **WHEN** the split decision is accepted in stage two
- **THEN** the pre-split exact count and card/visual seed records SHALL become stale
- **AND** each resulting concept SHALL receive separate card and visual-suitability review records, including an explicit reason when no visual card is warranted.

### Requirement: Review capacity uses a dedicated component count
Each block SHALL target 40–80 owned identity equivalence components in `candidate_concept_count`. A pending split SHALL count once until stage-two review. `exact_count` SHALL NOT be used for capacity because it also includes relations, cards, and migration inputs.

#### Scenario: A block is outside the target range
- **WHEN** `candidate_concept_count` is below 40 or above 80
- **THEN** a machine-readable indivisible-component or semantic-connectivity exception SHALL be required.
### Requirement: Migration items are active references
Semantic-block exact closure SHALL include only reviewed active legacy mappings and current course, resource, progress, note, or incomplete-path references. Historical facts, events, completed paths, and learner-derived state SHALL NOT be owned by a block.

#### Scenario: A historical event carries a knowledge ID
- **WHEN** exact items are partitioned
- **THEN** the event SHALL remain outside block closure and readiness.
