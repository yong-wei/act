## ADDED Requirements

### Requirement: Batch f8917af6bf755caf058c5358 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/17/members`, binding batchId `f8917af6bf755caf058c5358`, sequence `0`, semanticGroupKey `ctr:release:stability-analysis-engineering-v0.1|ctr:release:system-modeling-engineering-v0.1::entityType:Formula`, member count `1`, memberDigest `7e993c72b856c79dd49c277dc2afcb45621f157666eaf1a582b246bfe77a2270`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch f8917af6bf755caf058c5358 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch f8917af6bf755caf058c5358 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch f8917af6bf755caf058c5358 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for this profileOnly/highRisk member. The Primary source MUST be bound to session `015411ef-a0ce-4741-9adc-8f17062aac32` and SHA-256 `cb7838d76ac97c1cff8e513507173051e6e83fda8e8bf252c5d79fde7709ff8b`; the Challenger source MUST be bound to session `68f51aff-e853-48f2-9848-d99a27c3e6ae` and SHA-256 `c2df655e0644997d1464c85a72ec44ecfca5af76a69f14696ec8799e14669340`. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch f8917af6bf755caf058c5358

- **WHEN** Primary and Challenger conclusions differ for the member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Historical prior decision does not provide current authority

- **WHEN** the member has one `priorDecisionRef` into aggregate active history but no independent-course evidence
- **THEN** Primary and Challenger SHALL preserve that reference as provenance only, keep the conclusion role-free `DEFER` with `INSUFFICIENT` evidence, and SHALL NOT inherit its historical role or verdict

#### Scenario: Semantically equivalent authoring candidates are not frozen admissions

- **WHEN** `course-content/authoring/lessons/3-1/design/3-1-handout.md` around lines 331-340 and `course-content/authoring/lessons/3-1/design/3-1-interactive-page.md` around line 449 express semantically equivalent causal LTI convolution forms but are absent from the frozen `#1180` worklist/manifest `evidenceRefs`
- **THEN** those candidates SHALL remain diagnostic only; this frozen review SHALL keep the role-free `DEFER` with `INSUFFICIENT` evidence, and upstream `#1180` MUST bind/classify the candidates as independent-course evidence and regenerate the frozen worklist/manifest before any `INCLUDE`/`EXCLUDE` re-review

#### Scenario: DEFER is review-stage terminal only

- **WHEN** Primary and Challenger independently agree on `DEFER` without a semantic conflict
- **THEN** the receipt SHALL use `DEFERRED_EVIDENCE_BLOCKED`, leave CourseCoverage authority unresolved, keep the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and SHALL NOT write `ACTIVE`, authority, selector, or writer state

### Requirement: Batch f8917af6bf755caf058c5358 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve the exact ordered member reference, bind both raw stage-source artifacts through normalized documents and `review-provenance.json`, and prove that no out-of-slice member or production authority was written. The publication boundary MUST use the v3 proof and v2 detached-attestation schemas with identical content-equivalent replay.

#### Scenario: Receipt for batch f8917af6bf755caf058c5358 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `f8917af6bf755caf058c5358`, with `receiptDigest` `a84fb2a44cbf963b807b037fe9ce3822db193658b370c184eb44ffd5145dbf60` and detached `attestationDigest` `00a905992060e60289bc06b3c5a6331a102ae2998eca66d17f8e84873125d211`
- **AND** replay SHALL accept a squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion
