## ADDED Requirements

### Requirement: Batch babc4b83475400c53b2f46d7 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/6/members`, binding batchId `babc4b83475400c53b2f46d7`, sequence `0`, semanticGroupKey `ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:Formula`, member count `118`, memberDigest `63c8c031da440ea2ee55bc74154b8f1877e2779a4b658ada16277851a68ff151`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch babc4b83475400c53b2f46d7 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch babc4b83475400c53b2f46d7 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch babc4b83475400c53b2f46d7 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch babc4b83475400c53b2f46d7

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch babc4b83475400c53b2f46d7 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 118 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the aggregate Coverage gate SHALL remain blocked

### Requirement: Batch babc4b83475400c53b2f46d7 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The Primary writer session MUST be `50b93f16-c3e7-4a45-b9d2-d9b9d65df0f2`; the Challenger writer session MUST be `221b9aa4-9a64-4698-9dd9-38b09e6f4332`, and provenance MUST state that Challenger did not read Primary. The current publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch babc4b83475400c53b2f46d7 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `babc4b83475400c53b2f46d7`, with `receiptDigest` `a6736d12049c2132a2d22fce2d7619e533200fec561e56eaf2809ae87d04cc6a` and detached `attestationDigest` `5888a709321f639dd5473f8ddc9c40b3df1851d015d0ae9387daa471e0ee28e7`
- **AND** replay SHALL accept a squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion
