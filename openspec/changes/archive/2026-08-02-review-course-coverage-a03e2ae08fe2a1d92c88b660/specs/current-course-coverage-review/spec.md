## ADDED Requirements

### Requirement: Batch a03e2ae08fe2a1d92c88b660 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/28/members`, binding batchId `a03e2ae08fe2a1d92c88b660`, sequence `0`, semanticGroupKey `ctr:release:time-domain-analysis-engineering-v0.1::entityType:KnowledgeStatement`, member count `313`, memberDigest `9da6428fe743e960c735d9f060d6193e27bb98e1f90ba1d2b53d62c5f2d36aa6`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch a03e2ae08fe2a1d92c88b660 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch a03e2ae08fe2a1d92c88b660 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch a03e2ae08fe2a1d92c88b660 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch a03e2ae08fe2a1d92c88b660

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch a03e2ae08fe2a1d92c88b660 has no conflict

- **WHEN** required stages agree and every member remains evidence-insufficient
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, unique selectors, decision digests, and terminal outcome
- **AND** the terminal status SHALL be `DEFERRED_EVIDENCE_BLOCKED`
- **AND** no member SHALL receive a CourseCoverage role or production selector/writer-fence mutation

### Requirement: Batch a03e2ae08fe2a1d92c88b660 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, bind both normalized stage documents to their raw independent sources, and prove that no out-of-slice member or production authority was written. The detached boundary attestation MUST be published with the receipt and preserve protected-path snapshots for deterministic replay.

#### Scenario: Receipt for batch a03e2ae08fe2a1d92c88b660 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `a03e2ae08fe2a1d92c88b660`
- **AND** first publication SHALL produce a receipt and detached attestation with all production mutation flags false
- **AND** replay with identical inputs SHALL report identical artifacts and a content-equivalent replay mode

### Requirement: Batch a03e2ae08fe2a1d92c88b660 preserves independent raw-source closure

The normalized Primary and Challenger documents MUST be sealed from the two independent raw stage sources. Their source SHA-256, writer session IDs, stage input digests, and all `313 + 313 = 626` decision digests MUST be independently verifiable against the raw bytes and frozen batch binding.

#### Scenario: Raw source closure is verified

- **WHEN** the raw sources, normalized documents, worklist, and manifest are reread
- **THEN** source bindings, canonical IDs/revisions, conclusions, rationales, and selectors SHALL match in order
- **AND** all 626 decision digests SHALL be valid SHA-256 values
