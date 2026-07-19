## ADDED Requirements

### Requirement: Future-child records use a discriminated schema
Every record SHALL contain `change_id`, `work_kind`, `schema_version`, `algorithm_version`, `normalization_profile`, `exact_count`, structured `exact_items`, applicable `candidate_concept_count`, applicable `owner_block`, complete cross-block `endpoint_blocks`, change-ID `blockedBy`, structured `source_digests`, `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, `required_outputs`, `acceptance_profile`, and `scope_anchor_ids`.

#### Scenario: Typed item closure is checked
- **WHEN** a future-child record is validated
- **THEN** `exact_count` SHALL equal the number of typed `exact_items`
- **AND** duplicate keys SHALL be evaluated by `(item_kind, identity_namespace, source_id)` without cross-namespace string collapse.

### Requirement: Work-kind field applicability is enforced
The validator SHALL distinguish `semantic_block`, `cross_identity`, `cross_relation`, `resource_binding`, `global_closeout`, and `cutover`; require owners only where applicable; require complete endpoints for cross-block work; and include in-block relations, cards, and migration inputs in exact items.
Stage-one exact closure SHALL include card/visual work seeds for every identity component. Stage-two readiness SHALL instead require one `canonical_card_review` and one `visual_suitability_review` record for every final canonical concept. Any accepted split SHALL invalidate pre-split counts and SHALL require exact closure regeneration before validation can pass.

#### Scenario: A cross-block record omits endpoint blocks
- **WHEN** schema validation runs
- **THEN** validation SHALL fail.

### Requirement: Acceptance profiles and semantic phases are closed
The validator SHALL resolve every `acceptance_profile` through a closed work-kind-to-profile registry. `semantic_block` SHALL use `semantic-block-governance/v1` and SHALL require, for every final concept, a semantic profile containing unique semantic name, strict definition, semantic boundary, near-neighbor distinction, synonyms, scope basis, domain membership, and foundational-concept disposition. Its internal phase order SHALL be `semantic_profile`, then `canonical_card`, then `in_block_relation`; a later phase SHALL remain blocked until the previous phase passes.
Every `cross_identity`, `cross_relation`, and `resource_binding` record SHALL list in `blockedBy` the semantic-block change ID for every endpoint block. Cross-relation and resource-binding work SHALL consume named accepted semantic-profile outputs for all endpoints rather than an untyped status string.

#### Scenario: A relation child has an endpoint without an accepted semantic profile
- **WHEN** the future-series manifest is validated
- **THEN** the relation child SHALL fail dependency validation even if the general graph is acyclic.

#### Scenario: An unknown or mismatched acceptance profile is used
- **WHEN** a work kind references a profile outside the closed registry or assigned to another work kind
- **THEN** validation SHALL fail before exact closure is accepted.

### Requirement: Digests, dependencies, and drift close globally
The validator SHALL separately verify `governance_contract_digest`, `source_snapshot_digest`, structured `upstream_manifest_digests`, per-source digests, scope anchors, unique ownership, endpoint coverage, change-ID dependency closure, and acyclicity.

#### Scenario: Any expected input differs from observed input
- **WHEN** closeout runs
- **THEN** the report SHALL identify structured expected/observed drift
- **AND** stage-two readiness SHALL fail.

### Requirement: Validation does not create or execute stage two
The validator SHALL emit only a deterministic report and frozen candidate future-series manifest. It SHALL NOT create OpenSpec changes, Issues, migrations, projection imports, runtime cutovers, or production releases.

#### Scenario: A valid zero-item queue exists
- **WHEN** derivation proves no eligible items
- **THEN** the zero count, empty typed list, digests, and derivation evidence SHALL validate without a waiver.

### Requirement: Cutover records close every migration and write surface
The candidate `cutover` record SHALL include typed exact items for historical/path migration, immutable knowledge-truth revision generation/backfill, projection import, DB-only read-model cutover, and every source-registry direct-write entry. Each direct writer SHALL have exactly one `retire`, `authoring_workflow`, or `projection_only` disposition. Every affected `LearningFact` SHALL resolve to exactly one immutable knowledge-truth revision used when the fact was generated. Same-name definition, relation, and resource-binding maintenance SHALL create a new effective revision for subsequent facts without agent review or parallel active versions. Pre-contract facts whose revision cannot be proven SHALL bind to an explicit immutable `legacy-unversioned` revision tied to the governed source snapshot and SHALL NOT be interpreted using the current revision.
The cutover acceptance profile SHALL also require database-side before/after reconciliation for competency and seven-dimensional portrait snapshots, evidence caches, diagnosis snapshots, profile summaries, risk, growth, recommendations, and class aggregates, and SHALL preserve `ArenaSubmission` as the formal Arena score source. Reconciliation SHALL classify each row or governed group as `preserved`, `recomputed`, `expired`, `resolved`, `unresolved`, or `blocked`; prove latest-valid-snapshot uniqueness, authoritative lineage, split-evidence non-duplication, many-to-one merge evidence deduplication, zero unresolved retired references, recommendation invalidation/recomputation, and same-version class-aggregate inputs; and publish only small-cell-suppressed disposition counts and pass/fail summaries. Many-to-one deduplication SHALL first resolve the polymorphic `sourceLogId` namespace from explicit versioned lineage evidence and fact type: legacy simulation, question, AI-intervention, and prompt-design facts map respectively to their declared source tables; explicitly proven interaction facts map to `InteractionLog`; governed path `_recorded` facts use a non-relational path-event-key namespace. Unknown or ambiguous namespaces remain unresolved. The key SHALL then include namespace-qualified source identity, UTC-millisecond normalized authoritative event time, learner identity, evidence role or fact type, source lineage, and canonical destination, and SHALL NOT use the mapped knowledge ID or timestamp alone. Coexisting source IDs SHALL resolve to one lineage; conflicting time, role, learner, namespace, or lineage SHALL be blocked. Evidence with no governed source identity SHALL remain unresolved rather than being automatically merged.
Before validating those items, the registry SHALL pass Prisma DMMF table/field validation, schema-aware JSON decoder fixtures, transaction/export snapshot-proof validation, small-cell privacy validation, and bidirectional equality between statically discovered writer paths and declared direct writers.

#### Scenario: A direct writer has no cutover disposition
- **WHEN** the validator reconciles the source registry against cutover exact items
- **THEN** stage-two readiness SHALL fail.

#### Scenario: A learning fact has no knowledge-truth revision
- **WHEN** cutover reconciliation encounters an affected fact with a missing, ambiguous, or current-truth-guessed revision
- **THEN** cutover readiness SHALL fail unless the fact is bound to a snapshot-tied `legacy-unversioned` revision preserving that uncertainty.

#### Scenario: The registry omits a discovered writer or declares an invalid field
- **WHEN** closeout validation reconciles application sources
- **THEN** stage-two readiness SHALL fail before cutover records are accepted.

#### Scenario: A learner-derived record still cites a retired knowledge identity
- **WHEN** database-side semantic reconciliation runs
- **THEN** the record SHALL be unresolved or blocked and cutover readiness SHALL fail
- **AND** row keys, event payloads, prose, and row-level input digests SHALL remain outside repository artifacts.

#### Scenario: Duplicate source concepts merge into one canonical concept
- **WHEN** multiple old knowledge identities refer to the same authoritative event evidence and map to one canonical destination
- **THEN** the evidence SHALL contribute once after lineage-aware deduplication
- **AND** distinct events or evidence roles SHALL remain distinct.

#### Scenario: Source identifiers or event times conflict
- **WHEN** candidate duplicate evidence has inconsistent source-log/event lineage or normalized authoritative time
- **THEN** reconciliation SHALL mark it blocked instead of selecting one value or merging the evidence.
