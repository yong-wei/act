## ADDED Requirements

### Requirement: Batch 6826bdc48609e08a6af5efcb has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/12/members`, binding batchId `6826bdc48609e08a6af5efcb`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:SystemModel`, member count `10`, memberDigest `5068327c96f60c3e017a6634e032a6727b2879c376f33ada8abc34ada005e41f`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 6826bdc48609e08a6af5efcb is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 6826bdc48609e08a6af5efcb drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 6826bdc48609e08a6af5efcb produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 6826bdc48609e08a6af5efcb

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 6826bdc48609e08a6af5efcb has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome

### Requirement: Batch 6826bdc48609e08a6af5efcb emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written.

#### Scenario: Receipt for batch 6826bdc48609e08a6af5efcb is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `6826bdc48609e08a6af5efcb`

### Recorded implementation evidence

- The Primary and Challenger raw sources are bound by SHA-256 (`f8c69b836f4f6da30ea2f73df97ffe66b6c279747e79cc77ca87df407c71bbf5` and `52103ed1d7f63bba65428bed3f8d9fe4eaa69c53b5ac66420295e53784ace93c`) and by provenance to wrapper sessions `be3478ca-c446-46e6-b802-8faeb9079a93` and `72b3fcd8-acb6-49a9-a30f-3bd0147e5ba9`; Challenger did not read Primary. The source/provenance record retains the unresolved re-freeze risk for semantically adjacent course materials not present in frozen `evidenceRefs`.
- The assembled receipt records 10 `DEFER`, 0 `INCLUDE`, 0 `EXCLUDE`, 0 conflicts, and no Third review, with status `DEFERRED_EVIDENCE_BLOCKED`, `aggregateCoverageGate=BLOCKED_UNRESOLVED_EVIDENCE`, and all production mutation flags false. Receipt digest: `1df6f45facd6a452f00ac2c7616f69750434ffa37630574c5736dd7ceb1067bc`.
- The detached attestation uses schema/protocol v2 and is paired with the receipt by digest `c71e8312beef5626a25cf3934f587b4a7103790998828171d55b0a4b339af253`. Replaying the same content produced `publication=identical`, identical attestation, and `replayMode=content-equivalent`. These artifacts do not resolve global CourseCoverage authority or unblock the aggregate gate.
