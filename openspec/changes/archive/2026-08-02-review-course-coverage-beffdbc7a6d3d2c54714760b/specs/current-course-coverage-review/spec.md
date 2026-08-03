## ADDED Requirements

### Requirement: Batch beffdbc7a6d3d2c54714760b has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/21/members`, binding batchId `beffdbc7a6d3d2c54714760b`, sequence `1`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `284`, memberDigest `b36ed7c808c9e08302bdb20ade5a7a22520ee5983fe61ea2a7ff8813c62305a6`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch beffdbc7a6d3d2c54714760b is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch beffdbc7a6d3d2c54714760b drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch beffdbc7a6d3d2c54714760b produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions for all 284 `profileOnly=true` and `riskFlags.highRisk=true` KnowledgeStatement members. The Primary raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1211-course-coverage-review/primary-independent-stage-source.json` and bound to session `c9fc299b-f408-4b33-a927-6ee7d0e8c057` with SHA-256 `1849fe4c185d97b2173123108ec9494aba4e063580a60b7bddacbaa6f35d48bc`; the Challenger raw source MUST be preserved byte-for-byte at `course-content/authoring/knowledge/issue-1211-course-coverage-review/challenger-independent-stage-source.json` and bound to session `42e536dd-c725-4efd-857f-20b2f84a27da` with SHA-256 `bb23cbb5bb066d7ba0442207a7cb34ab25277f89d0e0347b7b7fd91fbcd41cc0`. Each normalized stage document MUST bind its raw source path, SHA-256, schema, stage, and writer session through `review-provenance.json`. Published artifacts MUST use logical repository-relative identifiers only and MUST NOT contain machine-local absolute paths. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Batch beffdbc7a6d3d2c54714760b has no conflict

- **WHEN** Primary and required Challenger independently agree on all 284 ordered members
- **THEN** the receipt SHALL preserve both independent rationales, evidence selectors, stage decision digests, and document digests with no Third stage; all 284 terminal members SHALL remain role-free `DEFER` with `INSUFFICIENT` evidence
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

### Requirement: Batch beffdbc7a6d3d2c54714760b emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member references, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 production-boundary proof and v2 detached-attestation schemas, with receiptDigest `46916d8eb30a8095442a7ff2926520fdef6494a396631ea69b4087ce26d62ba1` and attestationDigest `ec1ba67e9b5274ee23a662c3ee8059ae1133266ca6eca86c31069e85e8cde5a0`.

#### Scenario: Receipt for batch beffdbc7a6d3d2c54714760b is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `beffdbc7a6d3d2c54714760b`
- **AND** a second CLI replay SHALL report identical receipt and attestation bytes with `replayMode=content-equivalent` when protected-path bytes and clean status match the persisted ordered rows
