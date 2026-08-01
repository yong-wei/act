## ADDED Requirements

### Requirement: Frozen batch receipts distinguish review-stage terminality from CourseCoverage authority

Every frozen batch review MUST use independently authored stage records. Deterministic runtime code MAY validate bindings, calculate digests, detect conflicts, and assemble a receipt, but MUST NOT derive `INCLUDE`, `EXCLUDE`, or `DEFER` from risk flags, labels, profiles, or other input metadata. A review-stage terminal DEFER MUST remain unresolved for CourseCoverage authority and MUST keep the aggregate Coverage gate blocked.

#### Scenario: Independent reviewers agree evidence is insufficient

- **WHEN** Primary and required Challenger independently record role-free DEFER conclusions for a member
- **THEN** the batch receipt SHALL record `DEFERRED_EVIDENCE_BLOCKED` while the member remains unresolved for CourseCoverage authority

#### Scenario: Deterministic receipt assembly runs

- **WHEN** the batch assembler validates and merges stage records
- **THEN** it SHALL preserve authored conclusions without generating a conclusion or writing CURRENT, ACTIVE, selector, or writer-fence authority

### Requirement: Batch eddd24f003650f02d99f5b66 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/0/members`, binding batchId `eddd24f003650f02d99f5b66`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:DomainConcept`, member count `96`, memberDigest `451c6c53491105d2c4e94d0b9bf981cfce6f5996eecdda1a849d4ba9fdb165fd`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch eddd24f003650f02d99f5b66 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch eddd24f003650f02d99f5b66 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch eddd24f003650f02d99f5b66 produces independent review-stage conclusions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal. `INCLUDE` and `EXCLUDE` MUST carry a valid CourseCoverage role and sufficient independent current-course evidence. `DEFER` MUST carry no CourseCoverage role and MUST be represented as the review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`.

#### Scenario: Conflict occurs in batch eddd24f003650f02d99f5b66

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch eddd24f003650f02d99f5b66 has no conflict

- **WHEN** required stages agree and every member has a review-stage terminal conclusion
- **THEN** the receipt SHALL preserve each stage's independent rationale and terminal conclusion

#### Scenario: Evidence remains insufficient

- **WHEN** independent reviewers conclude that the frozen evidence cannot support inclusion or exclusion
- **THEN** the receipt SHALL record `DEFERRED_EVIDENCE_BLOCKED`, keep the member in the denominator, assign no CourseCoverage role, and keep the aggregate Coverage gate blocked

### Requirement: Batch eddd24f003650f02d99f5b66 emits a machine-mergeable receipt

The review receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and prove that no out-of-slice member or production authority was written. Deterministic code MUST validate and assemble independently authored stage records and MUST NOT generate semantic conclusions.

#### Scenario: Receipt for batch eddd24f003650f02d99f5b66 is assembled

- **WHEN** all required stages are review-stage terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, scoped to `eddd24f003650f02d99f5b66`, and incapable of writing CURRENT or ACTIVE CourseCoverage authority
