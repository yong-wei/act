## ADDED Requirements

### Requirement: Current worklist covers the admitted candidate exactly once
The system MUST derive the CourseCoverage worklist from the complete membership of the currently admitted Aggregate and its accepted Delta chain. Every reviewable Canonical object MUST appear exactly once and bind its current revision, entity type, semantic digest, source coverage, module membership, relation-neighborhood digest, evidence references, worklist input digest, Release/Delta identities and authoring revision. Historical item counts MUST NOT define the denominator.

#### Scenario: Current candidate membership is complete
- **WHEN** the admitted candidate and accepted Delta identities are unchanged during generation
- **THEN** the worklist SHALL contain every reviewable Canonical object exactly once and report `N_current` from the generated membership

#### Scenario: Member is duplicated, missing or unbound
- **WHEN** a Canonical member has zero or multiple rows or lacks a required current identity
- **THEN** worklist assembly SHALL fail without emitting a current review manifest

### Requirement: Historical decisions are non-authoritative review context
The system MAY include historical Coverage decisions only as provenance-bearing `priorDecisionRefs`. It MUST NOT copy a historical role, verdict or approval into the current decision surface. Profile-only status and evidence insufficiency MUST remain explicit in the current worklist and denominator.

#### Scenario: Prior decision exists for an unchanged label
- **WHEN** a historical decision references the same Canonical ID but another Release or worklist digest
- **THEN** the row SHALL expose it only as a prior reference and SHALL require a new current decision

#### Scenario: Profile-only evidence is insufficient
- **WHEN** an object has only Canonical profile metadata and no independent course evidence
- **THEN** the worklist SHALL retain the object, mark the evidence boundary and require the later review batch to resolve or block it

### Requirement: Review batches are deterministic and membership complete
The system MUST generate a review-batch manifest from the current worklist using stable semantic grouping and deterministic splitting. Each batch MUST bind one worklist digest, an exact ordered member list and member digest, review policy, source and type counts, profile-only members and required reviewer stages. Batch membership MUST be mutually exclusive and its union MUST equal the worklist denominator.

#### Scenario: Manifest is regenerated from identical input
- **WHEN** the same admitted candidate, worklist and authoring revision are used
- **THEN** every batch ID, member order, member digest and policy SHALL be byte-identical

#### Scenario: Batch membership overlaps or omits an item
- **WHEN** any Canonical item appears in multiple batches or in no batch
- **THEN** manifest generation SHALL fail and no review child change SHALL be eligible for registration

### Requirement: Review child changes are created only from the frozen manifest
Each later `review-course-coverage-<batch-id>` change MUST use a batch ID and exact member digest from the current manifest. The batch change MUST NOT add, drop or replace members. The current CourseCoverage gate MUST remain blocked until every manifest batch has an accepted decision assembly for the same worklist digest.

#### Scenario: Buddy child matches a manifest batch
- **WHEN** a proposed review child names an exact batch ID and member digest from the current manifest
- **THEN** it MAY be registered as a review work item blocked by this change

#### Scenario: Proposed child uses a provisional or historical batch
- **WHEN** a proposed child is not present in the current manifest or uses another member digest
- **THEN** registration and Coverage assembly SHALL reject it

### Requirement: Candidate drift invalidates the worklist and batches
The system MUST compare the admitted Aggregate, Release, Delta, worklist input and authoring revisions before publishing the manifest and before assembling decisions. Any drift MUST invalidate the worklist and every dependent unfinished batch. No production CourseCoverage selector or other authority selector may change in this change.

#### Scenario: Aggregate changes before manifest publication
- **WHEN** the latest admitted identity differs from the worklist input identity
- **THEN** the generator SHALL reject the worklist and require regeneration from the new candidate

#### Scenario: Worklist and manifest are valid
- **WHEN** all denominator, digest, evidence and batch-closure checks pass
- **THEN** the system SHALL publish review inputs while leaving CourseCoverage and production selectors unchanged
