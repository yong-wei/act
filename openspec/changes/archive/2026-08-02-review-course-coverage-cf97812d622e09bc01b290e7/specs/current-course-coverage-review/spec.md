## ADDED Requirements

### Requirement: Batch cf97812d622e09bc01b290e7 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/19/members`, binding batchId `cf97812d622e09bc01b290e7`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:Formula`, member count `299`, memberDigest `51b1aa828c6d4f8946f51964393253127c6a979167b6fc6b43e831dd1cb24a49`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch cf97812d622e09bc01b290e7 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch cf97812d622e09bc01b290e7 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch cf97812d622e09bc01b290e7 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions for all 299 `profileOnly=true` and `riskFlags.highRisk=true` Formula members. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1209-course-coverage-review/primary-independent-stage-source.json` and bound to session `1d8f2d19-41db-4479-a854-d7284f16fbe0` with SHA-256 `ae90d30f43316821c7f8a8d57a3f8b8e63f807a5d104fe4fd0bd23e461463f1a`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1209-course-coverage-review/challenger-independent-stage-source.json` and bound to session `ac434809-5488-46f9-a5ee-810a159ea56b` with SHA-256 `f7f7257d2cee95cd904530cda5fd055019d17602d3736453afdaeaf9a16d5a8d`. Each normalized stage document MUST bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Batch cf97812d622e09bc01b290e7 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 299 ordered members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 299 terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
- **AND** the review stage SHALL be `DEFERRED_EVIDENCE_BLOCKED`, CourseCoverage authority SHALL remain unresolved, and the aggregate gate SHALL remain `BLOCKED_UNRESOLVED_EVIDENCE`

#### Scenario: Frozen evidence is aggregate/profile only

- **WHEN** every frozen evidence reference for the batch is bounded to `aggregate` or `profile` and no member has admitted `independent-course` evidence
- **THEN** neither stage SHALL issue `INCLUDE` or `EXCLUDE`, and no historical or semantic candidate observation SHALL supply a role or current authority

#### Scenario: Unfrozen semantic candidates are diagnostic only

- **WHEN** Primary or Challenger observes semantically related course-authoring material outside the frozen `evidenceRefs`
- **THEN** the observation SHALL remain diagnostic only; upstream issue `#1180` MUST bind and classify accepted candidates as `independent-course` evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and Challenger independently agree on role-free `DEFER` with insufficient evidence
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, set `thirdRequired=false`, preserve zero conflicts and zero Third reviews, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch cf97812d622e09bc01b290e7 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `60f50866a13a99d376dd9d12d78bb0beaa567937c635607f7290de2345891475` and attestationDigest `8996100cd78f4426abf1bfa3dfc4b1c1b4ed8a57bfe447b78da60e7a890dbfff`.

#### Scenario: Receipt for batch cf97812d622e09bc01b290e7 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `cf97812d622e09bc01b290e7`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows
