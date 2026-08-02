## ADDED Requirements

### Requirement: Batch f699aa47a9afaf3057d4bc0e has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/23/members`, binding batchId `f699aa47a9afaf3057d4bc0e`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:DomainConcept`, member count `265`, memberDigest `e026fadcfcdfdd5798b11f76bf9e7e5eed23f548756457850e344909782fd852`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch f699aa47a9afaf3057d4bc0e is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch f699aa47a9afaf3057d4bc0e drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch f699aa47a9afaf3057d4bc0e produces independent terminal decisions

Primary MUST issue independent conclusions for all 265 ordered members. Challenger MUST issue independent conclusions for the 224 members whose frozen manifest risk surface has `profileOnly=true` or `riskFlags.highRisk=true`. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1213-course-coverage-review/primary-independent-stage-source.json` and bound to session `170364f7-6d6e-44d5-b936-96f8b6553af5` with SHA-256 `6660b119a1fec34754cb77a88b566e749be66e4025be223f222097fc067a620b`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1213-course-coverage-review/challenger-independent-stage-source.json` and bound to session `4d714ca0-a746-4df4-939f-65a3a13dec78` with SHA-256 `36b9de0e261662e5c98d699d67c72756e33bf4c4398f9091be0de0857c3b0b54`. Each normalized stage document MUST bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. A conflict would require Third to be terminal; this batch has zero conflicts, so no Third source or normalized artifact is permitted.

#### Scenario: Batch f699aa47a9afaf3057d4bc0e has no conflict

- **WHEN** Primary and required Challenger independently agree on all 224 required members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 224 agreed terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
- **AND** the five non-risk Primary-only members SHALL preserve their valid `INCLUDE` roles and `SUFFICIENT` evidence
- **AND** the review stage SHALL be `DEFERRED_EVIDENCE_BLOCKED`, CourseCoverage authority SHALL remain unresolved, and the aggregate gate SHALL remain `BLOCKED_UNRESOLVED_EVIDENCE`

#### Scenario: Frozen evidence boundaries govern admission

- **WHEN** a member lacks sufficient frozen `independent-course` evidence for a role decision
- **THEN** neither stage SHALL use aggregate/profile evidence, prior decisions, labels, or unfrozen semantic candidates as current CourseCoverage authority

#### Scenario: Unfrozen semantic candidates are diagnostic only

- **WHEN** Primary observes semantically related course-authoring material outside the frozen `evidenceRefs`
- **THEN** the observation SHALL remain diagnostic only; upstream issue `#1180` MUST bind and classify accepted candidates as `independent-course` evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and required Challenger agree on role-free `DEFER` with insufficient evidence
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, set `thirdRequired=false`, preserve zero conflicts and zero Third reviews, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch f699aa47a9afaf3057d4bc0e emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `212e67d8400ac94e85c2dfedfa2c658f09d2516a9fc3e5e5f2db46d38fb55b8b` and attestationDigest `cb43e8a1bc76c7b2d6660435f76f5b727c52688a27f027edd92356f9208568be`.

#### Scenario: Receipt for batch f699aa47a9afaf3057d4bc0e is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `f699aa47a9afaf3057d4bc0e`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows
