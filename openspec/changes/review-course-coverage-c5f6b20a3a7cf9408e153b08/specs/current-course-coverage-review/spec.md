## ADDED Requirements

### Requirement: Batch c5f6b20a3a7cf9408e153b08 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/20/members`, binding batchId `c5f6b20a3a7cf9408e153b08`, sequence `0`, semanticGroupKey `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `500`, memberDigest `81fedba91c18ba7fbb40e3575e96445135485bfbd6af9c1c8fc5bd82bfba5f49`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and manifestArtifactSha256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch c5f6b20a3a7cf9408e153b08 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member
- **AND** the normalized Primary and Challenger documents SHALL preserve all 500 ordered canonical IDs/revisions and the frozen evidence selectors without changing the raw stage conclusions

#### Scenario: Batch c5f6b20a3a7cf9408e153b08 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence
- **AND** all public artifact paths and `commandsRun` entries SHALL remain repository-relative

### Requirement: Batch c5f6b20a3a7cf9408e153b08 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal. For this batch, Primary session `9abcc13d-1c7e-4e95-9664-9a9996876d16` and Challenger session `7dc9f9ac-f9ac-4192-887e-393b9f555c7d` MUST remain independently bound to their raw stage sources. Both normalized stages MUST record 500 `DEFER` conclusions because the frozen evidence boundary has 729 aggregate refs, 500 profile refs, and zero independent-course members; diagnostic course candidates MUST remain non-authoritative with `reFreezeRequired=true`.

#### Scenario: Conflict occurs in batch c5f6b20a3a7cf9408e153b08

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch c5f6b20a3a7cf9408e153b08 has no conflict

- **WHEN** required stages agree and all members are resolved
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal outcome
- **AND** the receipt SHALL report zero conflicts, zero Third reviews, zero INCLUDE/EXCLUDE, and 500 deferred evidence-blocked members

### Requirement: Batch c5f6b20a3a7cf9408e153b08 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. The first publication MUST use the v3 ordered protected-path production-boundary proof and detached v2 attestation, with receiptDigest `eaf06a0180e0d4b8acd4e35283a3d7baa546cef318a99855c03260a5beb12c65` and attestationDigest `a5fe78541257603d477145aa7fe89056ad2f38c884d15b8ad2a0cd7052944066`. No selector, writer fence, ACTIVE decision, or Third artifact may be written.

#### Scenario: Receipt for batch c5f6b20a3a7cf9408e153b08 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `c5f6b20a3a7cf9408e153b08`

#### Scenario: Content-equivalent replay of the published pair

- **WHEN** the shared batch-review CLI is invoked a second time with the same repository-relative worklist, manifest, normalized stage inputs, expected binding, and output path
- **THEN** it SHALL return `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`, preserving the same receipt and attestation digests
