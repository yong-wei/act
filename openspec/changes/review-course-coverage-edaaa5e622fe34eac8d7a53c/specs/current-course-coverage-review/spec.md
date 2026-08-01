## ADDED Requirements

### Requirement: Batch edaaa5e622fe34eac8d7a53c has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/32/members`, binding batchId `edaaa5e622fe34eac8d7a53c`, sequence `0`, semanticGroupKey `ctr:root-locus-engineering-v0.1::entityType:KnowledgeStatement`, member count `1`, memberDigest `c600712a595a2eece7471c52d228698d15c35d2f375dfd7f44f86b63d8f4ddc8`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch edaaa5e622fe34eac8d7a53c is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch edaaa5e622fe34eac8d7a53c drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch edaaa5e622fe34eac8d7a53c produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch edaaa5e622fe34eac8d7a53c

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch edaaa5e622fe34eac8d7a53c has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch edaaa5e622fe34eac8d7a53c emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch edaaa5e622fe34eac8d7a53c is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `edaaa5e622fe34eac8d7a53c`
