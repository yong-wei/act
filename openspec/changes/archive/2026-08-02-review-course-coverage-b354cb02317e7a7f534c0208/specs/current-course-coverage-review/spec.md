## ADDED Requirements

### Requirement: Batch b354cb02317e7a7f534c0208 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/24/members`, binding batchId `b354cb02317e7a7f534c0208`, sequence `0`, semanticGroupKey `ctr:release:system-modeling-engineering-v0.1::entityType:Formula`, member count `204`, memberDigest `2f9178a55173b126c348544ebf05dac5b41553da630f95bc67366d0df618179e`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch b354cb02317e7a7f534c0208 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch b354cb02317e7a7f534c0208 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch b354cb02317e7a7f534c0208 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for the shared risk slice selected by `profileOnly || new || changed || highRisk` members. Every conflict MUST enter Third, and Third MUST be terminal. For batch `b354cb02317e7a7f534c0208`, Primary reviewed all `204` members and Challenger reviewed `202` risk members; frozen non-risk ordinals `2` and `24` are omitted from Challenger stage decisions while remaining bound by the full receipt.

#### Scenario: Conflict occurs in batch b354cb02317e7a7f534c0208

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch b354cb02317e7a7f534c0208 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

#### Scenario: Batch b354cb02317e7a7f534c0208 has unresolved evidence

- **WHEN** Primary and Challenger both return `DEFER` with insufficient evidence and no semantic conflict
- **THEN** the receipt SHALL be `DEFERRED_EVIDENCE_BLOCKED`, contain `204` terminal deferred members, omit Third, and keep all production mutation flags false

### Requirement: Batch b354cb02317e7a7f534c0208 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch b354cb02317e7a7f534c0208 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `b354cb02317e7a7f534c0208`

#### Scenario: Batch b354cb02317e7a7f534c0208 is replayed

- **WHEN** the same CLI inputs and protected authority snapshot are replayed
- **THEN** publication SHALL be `identical`, the detached attestation SHALL be `identical`, and no production authority path SHALL change
