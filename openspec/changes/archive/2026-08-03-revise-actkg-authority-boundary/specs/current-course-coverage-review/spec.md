## MODIFIED Requirements

### Requirement: Current worklist covers the admitted candidate exactly once
The current CourseCoverage worklist MUST enumerate only the ACT-owned teaching scope selected for the active projection, with one row per in-scope resource or explicitly selected core node. It MUST retain Release/Delta identity, semantic digest, evidence, and authoring revision. Complete Aggregate membership, Aggregate/profile-only metadata, historical Release membership, and old batch counts MUST NOT define the ACT denominator or an engineering Authority gate; an upstream object without an ACT binding MUST remain outside the worklist.

For this requirement, `canonicalRevision` means the SHA-256 digest of the deterministic semantic object payload: Canonical ID, entity type, semantic/display labels, description, concept kind, release tier, publication/review status and source-coverage count. It MUST exclude generation time, packaging paths and any current role, verdict, approval or outcome.

#### Scenario: Current candidate membership is complete
- **WHEN** the admitted ActKG Release identities are unchanged and the ACT teaching scope is selected
- **THEN** the worklist SHALL contain every selected ACT teaching resource/core node exactly once
- **AND** it SHALL NOT require membership equal to the full Release `N_current`

#### Scenario: Member is duplicated, missing or unbound
- **WHEN** an ACT resource/core-node appears zero or multiple times or lacks a current Canonical identity
- **THEN** worklist assembly SHALL fail closed for that Teaching Projection
- **AND** it SHALL not invalidate the upstream engineering Release

#### Scenario: ACT teaching scope is empty
- **WHEN** an integrity-valid ActKG Release has no selected ACT teaching resources
- **THEN** the worklist MAY be empty and the Teaching Projection SHALL be `NOT_PROJECTED`
- **AND** engineering Authority SHALL not be blocked by an empty worklist

#### Scenario: In-scope resource is duplicated or missing identity
- **WHEN** an ACT resource/core-node appears zero or multiple times or lacks a current Canonical identity
- **THEN** worklist assembly SHALL fail closed for that Teaching Projection
- **AND** it SHALL not invalidate the upstream engineering Release

### Requirement: Historical decisions are non-authoritative review context
The system MAY include historical Coverage decisions only as provenance-bearing `priorDecisionRefs`. It MUST NOT copy a historical role, verdict, approval, aggregate membership, or profile-only status into the current ACT teaching decision surface. The current denominator SHALL contain only explicitly selected ACT teaching resources/core nodes and their direct prerequisite endpoints; upstream Aggregate/profile-only objects that have no ACT binding SHALL remain outside the denominator. The 34 historical batches and their 4,880 `DEFER` rows MUST remain immutable audit context only.

#### Scenario: Prior decision exists for an unchanged label
- **WHEN** a historical decision references the same Canonical ID but another Release or worklist digest
- **THEN** the row MAY expose it only as a prior reference
- **AND** if the current ACT teaching scope does not bind the object, it SHALL not enter the current denominator

#### Scenario: Profile-only evidence is insufficient
- **WHEN** an object has only Canonical profile metadata and no independent course evidence and is not selected by the ACT teaching scope
- **THEN** it SHALL remain outside the current ACT worklist denominator
- **AND** its absence SHALL not block Engineering Authority

#### Scenario: Evidence source classification is explicit
- **WHEN** a prior evidence reference is loaded for an in-scope ACT teaching resource
- **THEN** only lesson authoring files and syllabus blueprint/main files SHALL count as `independent-course`; canonical metadata and topic lexicon SHALL remain aggregate provenance, and each evidence reference SHALL declare whether its digest covers raw bytes, selector evidence or a semantic payload

#### Scenario: Prior decision exists for an unchanged or unbound upstream object
- **WHEN** a historical decision references a Canonical ID from another Release/worklist digest but the current ACT teaching scope does not bind it
- **THEN** the row MAY expose the historical decision only as a prior reference
- **AND** the object SHALL not enter the current ACT denominator or require a new teaching decision

#### Scenario: Profile-only evidence is insufficient and unbound
- **WHEN** an object has only Canonical profile/aggregate metadata and no ACT course/resource binding
- **THEN** it SHALL remain outside the current ACT worklist denominator
- **AND** its absence SHALL not block Engineering Authority or Teaching Projection publication

#### Scenario: Historical DEFER is loaded
- **WHEN** the frozen legacy audit manifest contains a `DEFER` for an object that is not selected by the current ACT teaching scope
- **THEN** the manifest SHALL retain the exact receipt and evidence boundary for audit
- **AND** the `DEFER` SHALL not create a current worklist row, selector block, or Authority decision

### Requirement: Frozen batch receipts distinguish review-stage terminality from CourseCoverage authority
The 34 historical batch receipts SHALL be preserved as an immutable legacy audit manifest containing exact members, digests, strategy version, capture identity, and the 11 `INCLUDE`/4,880 `DEFER` outcome counts. Their review-stage terminality is historical evidence only; no new Authority, Repository, or consumer selector MAY read those verdicts as a global blocking condition. Deterministic runtime code MAY validate bindings, calculate digests, detect conflicts, and assemble a receipt, but MUST NOT derive live Authority blocks from historical `INCLUDE`, `EXCLUDE`, or `DEFER`.

#### Scenario: Independent reviewers agree evidence is insufficient
- **WHEN** Primary and required Challenger independently record role-free DEFER conclusions for a historical member
- **THEN** the batch receipt SHALL retain `DEFERRED_EVIDENCE_BLOCKED` as historical audit evidence
- **AND** new selectors SHALL NOT treat that DEFER as an Engineering Authority or global consumer block

#### Scenario: Deterministic receipt assembly runs
- **WHEN** the batch assembler validates and merges stage records
- **THEN** it SHALL preserve authored conclusions without generating a conclusion or writing CURRENT, ACTIVE, selector, or writer-fence authority

#### Scenario: Legacy manifest is read by a new selector
- **WHEN** a selector loads the frozen legacy audit manifest
- **THEN** it SHALL expose provenance and audit counts only
- **AND** it SHALL derive no Authority or consumer block from `DEFER`

#### Scenario: Legacy manifest is altered
- **WHEN** manifest bytes or its capture/digest identity differ from the frozen record
- **THEN** the selector SHALL fail closed and retain the prior valid state
