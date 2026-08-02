## ADDED Requirements

### Requirement: Batch 99ffc86682c95d2c087c8754 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/15/members`, binding batchId `99ffc86682c95d2c087c8754`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `174`, memberDigest `52fec2d28fa1a6934510c46427e9edd6196b21e0dee0cf193f7754f3bacc8e3b`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 99ffc86682c95d2c087c8754 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 99ffc86682c95d2c087c8754 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 99ffc86682c95d2c087c8754 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 99ffc86682c95d2c087c8754

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 99ffc86682c95d2c087c8754 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and review-stage terminal conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 99ffc86682c95d2c087c8754 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the independent Primary/Challenger stage-source artifacts through each normalized stage document and provenance record, and prove that no out-of-slice member or production authority was written. Its v3 production-boundary proof and v2 detached attestation MUST preserve ordered protected-path digests for squash-safe identical replay.

#### Scenario: Receipt for batch 99ffc86682c95d2c087c8754 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `99ffc86682c95d2c087c8754`
