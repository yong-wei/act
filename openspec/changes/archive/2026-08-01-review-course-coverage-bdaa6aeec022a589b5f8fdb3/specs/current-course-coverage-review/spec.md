## ADDED Requirements

### Requirement: Batch bdaa6aeec022a589b5f8fdb3 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/2/members`, binding batchId `bdaa6aeec022a589b5f8fdb3`, sequence `0`, semanticGroupKey `ctr:release:classical-control-design-engineering-v0.1::entityType:KnowledgeStatement`, member count `500`, memberDigest `ab17716fb40cce4d6c8793e51b094e20eb452d98b29a2b1a9f265d12bfc1e70d`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, and manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`.

#### Scenario: Frozen batch bdaa6aeec022a589b5f8fdb3 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch bdaa6aeec022a589b5f8fdb3 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence
