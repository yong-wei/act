## ADDED Requirements

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/33/members`, binding batchId `84aa72597e8fe1d9ee6f0602`, sequence `0`, semanticGroupKey `ctr:root-locus-engineering-v0.1::entityType:SystemModel`, member count `1`, memberDigest `8ee4109996fc05d510290a3620c6172e8107421e9695a1aa79c13e5cbe4040e4`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 84aa72597e8fe1d9ee6f0602 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 84aa72597e8fe1d9ee6f0602 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict within the required Challenger slice MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 84aa72597e8fe1d9ee6f0602

- **WHEN** Primary and Challenger conclusions differ for a required Challenger member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 84aa72597e8fe1d9ee6f0602 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 84aa72597e8fe1d9ee6f0602 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 84aa72597e8fe1d9ee6f0602 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `84aa72597e8fe1d9ee6f0602`
