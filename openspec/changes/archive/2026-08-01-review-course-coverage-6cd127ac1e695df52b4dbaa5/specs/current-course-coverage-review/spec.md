## ADDED Requirements

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/11/members`, binding batchId `6cd127ac1e695df52b4dbaa5`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `407`, memberDigest `93ab74af657df935220a7f5302922792ce64e5e3a9ca8474c7683f87984f87c8`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 6cd127ac1e695df52b4dbaa5 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 6cd127ac1e695df52b4dbaa5 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 6cd127ac1e695df52b4dbaa5

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 6cd127ac1e695df52b4dbaa5 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and conclusion
- **AND** any `DEFER` conclusion SHALL remain role-free, leave CourseCoverage authority unresolved, and produce `DEFERRED_EVIDENCE_BLOCKED` with the aggregate coverage gate blocked

### Requirement: Batch 6cd127ac1e695df52b4dbaa5 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 6cd127ac1e695df52b4dbaa5 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `6cd127ac1e695df52b4dbaa5`
