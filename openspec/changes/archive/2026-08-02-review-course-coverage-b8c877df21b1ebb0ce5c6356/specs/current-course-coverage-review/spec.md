## ADDED Requirements

### Requirement: Batch b8c877df21b1ebb0ce5c6356 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/25/members`, binding batchId `b8c877df21b1ebb0ce5c6356`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:KnowledgeStatement`, member count `171`, memberDigest `e5d637bbe468048744a6ff80ecd54d973c9924423d456324a281d66a9e819e56`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch b8c877df21b1ebb0ce5c6356 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch b8c877df21b1ebb0ce5c6356 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch b8c877df21b1ebb0ce5c6356 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. For this frozen batch, Primary's byte-preserved remediation source is `course-content/authoring/knowledge/issue-1215-course-coverage-review/primary-independent-stage-source.json` with SHA-256 `cbda7f5c7122f5d0b457a63de56a6cbc9bf7b199f1cad4833dc1e2b37e826044`, session `e0bc3434-6424-4782-88b5-a78fc7e18bf2`, and normalized v2 digest `162ac8b0a4c5f3569bec61da996deffb6ba3c2e6936c0b92253963104c5ca59a`. That independent Primary remediation accepted PR #1253 P1 and re-audited only ordinals `69,109,132,137,142` against their frozen selectors without reading Challenger/Third artifacts; all five became role-free `DEFER`. Challenger's byte-preserved source is `course-content/authoring/knowledge/issue-1215-course-coverage-review/challenger-independent-stage-source.json` with SHA-256 `5a7521ced17491a3e325dd321468e3afe73074e194e53e031dd539192e5edc23`, session `74224160-f779-4995-bf7e-6ae8e8105f26`, and normalized v2 digest `f8c5ab643f335e77a681ceadc85c3c32a1eeb607e6c241a09fce3b4825ad65cc`. Both v2 stages preserve raw frozen evidence order as aligned `evidenceSelectors` and exact `evidenceIds`; repeated selectors are disambiguated by evidenceId. Primary records 0 `INCLUDE`, 171 `DEFER`, and 0 `EXCLUDE`; Challenger records 137 role-free `DEFER`. Every conflict MUST enter Third, and Third MUST be terminal; their required risk-slice conclusions agree, so this batch has zero conflicts and MUST NOT contain Third artifacts.

#### Scenario: Conflict occurs in batch b8c877df21b1ebb0ce5c6356

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch b8c877df21b1ebb0ce5c6356 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch b8c877df21b1ebb0ce5c6356 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. This batch's receipt digest is `07ec146b188d5930d4df9a949d936aef97c32392f11bac25acfe496f9924b22a` and its boundary-attestation digest is `b97daff16ed3dbea169586e7a824304f184f168436d4d40db73bd6131af12f77`; it is `DEFERRED_EVIDENCE_BLOCKED`, leaves all 171 members unresolved, and keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`.

#### Scenario: Receipt for batch b8c877df21b1ebb0ce5c6356 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `b8c877df21b1ebb0ce5c6356`
