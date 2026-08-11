## ADDED Requirements

### Requirement: Batch 00617fd6a22c8b84c2e91142 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/26/members`, binding batchId `00617fd6a22c8b84c2e91142`, sequence `0`, semanticGroupKey `ctr:release:time-domain-analysis-engineering-v0.1::entityType:DomainConcept`, member count `147`, memberDigest `362665fd1a4c18baad85eb8b44407dfd87b3720ce1dd3e607749f525adac0ea7`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch 00617fd6a22c8b84c2e91142 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 00617fd6a22c8b84c2e91142 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 00617fd6a22c8b84c2e91142 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 00617fd6a22c8b84c2e91142

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 00617fd6a22c8b84c2e91142 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 147 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent raw-source binding, rationale, evidence selectors, exact evidence IDs, canonical decision digests, and normalized document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the global gate SHALL remain blocked

### Requirement: Batch 00617fd6a22c8b84c2e91142 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. It MUST bind `review-provenance.json` through `reviewProvenanceBinding`, including repository-relative source paths, raw-byte SHA-256 values, distinct Primary and Challenger writer sessions/scopes, normalized v2 stage documents, and Challenger's `didNotReadPrimaryArtifact=true` audit. The Primary source writer session MUST be `b76983ed-6bbe-448a-a688-0d320e8a85c2`; the Challenger source writer session MUST be `f068c4e1-ee97-4b4b-a448-02bc1a0f476a`; the bound provenance SHA-256 MUST be `fa63ac5ad7f3f09073157f21fae39146bc8f90fa0d2dabe28d96c1727f533f2e`. This new publication MUST use the v3 production-boundary proof and v2 detached-attestation pair, and content-equivalent replay MUST fail closed if provenance or protected-path bindings drift.

#### Scenario: Receipt for batch 00617fd6a22c8b84c2e91142 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `00617fd6a22c8b84c2e91142`, with `receiptDigest` `ff36f047f9d1558dfddcfa6c8cf15d886216bda3ec812b801a7e3bf88ba8294f` and detached `attestationDigest` `2e3897efacb6264771db2449a9e3f4b8f4bdbfc828884d228e447bee4f9882d3`
- **AND** replay SHALL accept only an identical content-equivalent continuation when the persisted protected-path rows and clean status still match
