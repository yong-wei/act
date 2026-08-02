## ADDED Requirements

### Requirement: Batch 0bc82e9dcca813c8a75f11bd has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/8/members`, binding batchId `0bc82e9dcca813c8a75f11bd`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:SystemModel`, member count `4`, memberDigest `463c5396f60d309f07ce3405d690e70e00b3ce70dbdbef5f8ce3bcad67b933ec`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch 0bc82e9dcca813c8a75f11bd is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 0bc82e9dcca813c8a75f11bd drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 0bc82e9dcca813c8a75f11bd produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 0bc82e9dcca813c8a75f11bd

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 0bc82e9dcca813c8a75f11bd has no conflict

- **WHEN** Primary and required Challenger independently agree on all 4 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the aggregate Coverage gate SHALL remain blocked

### Requirement: Batch 0bc82e9dcca813c8a75f11bd emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The Primary writer session MUST be `f03d0a8b-dec9-4c1f-b000-f7ae8c070810`; the Challenger writer session MUST be `e2ca2013-0c13-49a9-b33a-8f6ed92521eb`, and provenance MUST state that Challenger did not read Primary. The publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch 0bc82e9dcca813c8a75f11bd is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `0bc82e9dcca813c8a75f11bd`, with first-publication `receiptDigest` `f86165449d3216c5d4b4ad5360b7383adeb7e7042fb526e101980251095b58e5` and detached `attestationDigest` `5b3d39dbecf1e39470219c43225ea572846b8b6b5d2186a1db39ed54a63ee0f5`
- **AND** the v3 proof/v2 detached attestation SHALL support squash/content-equivalent replay when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion
