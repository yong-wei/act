## ADDED Requirements

### Requirement: Batch 3c6973d82b44357efc73f2f8 has an immutable review boundary

The review child MUST process only the exact ordered members at `batch-manifest.json#/batches/10/members`, binding batchId `3c6973d82b44357efc73f2f8`, sequence `0`, semanticGroupKey `ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:Formula`, member count `232`, memberDigest `321f283c747e5068c1de2dcb0e69939afe0991c6154dc3d8db3e9f853f0455c8`, worklistInputDigest `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`, worklistDigest `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`, manifestDigest `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`, and raw manifest artifact SHA-256 `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`.

#### Scenario: Frozen batch 3c6973d82b44357efc73f2f8 is unchanged

- **WHEN** all bound fields and canonical revisions match the manifest slice
- **THEN** the child SHALL admit exactly that ordered member set and no other member

#### Scenario: Batch 3c6973d82b44357efc73f2f8 drifts

- **WHEN** any member, order, digest, or revision differs
- **THEN** review and receipt assembly SHALL fail closed without changing production selector or writer fence

### Requirement: Batch 3c6973d82b44357efc73f2f8 produces independent terminal decisions

Primary and Challenger MUST issue independent conclusions; Challenger MUST run for profileOnly, new, changed, or highRisk members. Every conflict MUST enter Third, and Third MUST be terminal.

#### Scenario: Conflict occurs in batch 3c6973d82b44357efc73f2f8

- **WHEN** Primary and Challenger conclusions differ for a member
- **THEN** Third SHALL record the terminal conclusion and rationale in the receipt

#### Scenario: Batch 3c6973d82b44357efc73f2f8 has no conflict

- **WHEN** Primary and required Challenger independently agree on all 232 ordered members and no conflict is present
- **THEN** the receipt SHALL preserve each stage's independent source binding, rationale, evidence selectors, canonical decision digests, and document digest, with no Third stage
- **AND** every member SHALL remain a role-free `DEFER` with insufficient evidence and review-stage terminal state `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority SHALL remain unresolved and the global gate SHALL remain blocked

### Requirement: Batch 3c6973d82b44357efc73f2f8 emits a machine-mergeable receipt

The decision receipt MUST be keyed by every batch binding digest, preserve exact ordered member references, and bind the Primary and Challenger raw source artifacts and normalized stage documents through `review-provenance.json`. The receipt MUST seal the provenance repository-relative path, raw-byte SHA-256, distinct stage sessions/scopes, source/document bindings, and Challenger non-read audit into `reviewProvenanceBinding`; any receipt with that binding MUST use the current v3 proof and v2 detached-attestation pair, and replay MUST fail closed if the provenance or binding is absent or any binding or audit field drifts. Any historical receipt without provenance binding, whether v2/v1 or v3/v2, MUST require an exact match of the tracked receipt path and digest plus detached-attestation path and digest; compatibility is limited to the eighteen tracked pairs from Issues 1190–1199, 1201–1203, 1205, 1207, 1213, 1214, and 1218. Field absence, batch identity, self-reported protocol version, or a recomputed digest MUST NOT grant compatibility. The Primary writer session MUST be `42eca660-ca20-49d4-b9df-93d9651ad3f2`; the Challenger writer session MUST be `37cc1c54-54d1-4cc0-a174-c440ed0294fe`, and the bound provenance SHA-256 MUST be `eee0d6dcbccab41287492f2feb7348a0419b62478d0be0565c509a9e97122a18`. Provenance MUST state and audit that Challenger did not read Primary. The receipt MUST also prove that no out-of-slice member or production authority was written. The current publication boundary MUST use the v3 proof and v2 detached-attestation schemas and preserve ordered protected-path digests for squash-safe content-equivalent replay.

#### Scenario: Receipt for batch 3c6973d82b44357efc73f2f8 is assembled

- **WHEN** all required stages are terminal and drift checks pass
- **THEN** the receipt SHALL be deterministic, machine-mergeable, and scoped to `3c6973d82b44357efc73f2f8`, with `receiptDigest` `2309285ee5acef97d6076135c8d9da29fbd642d1053e314b8f867e737a83c347` and detached `attestationDigest` `1fdf6b0398f01aa590f01e83cb48d834191d8ba9958fad77b603dc0b6a8c5d83`
- **AND** replay SHALL accept an identical squash/content-equivalent continuation when protected-path bytes and clean status match the persisted ordered rows, without requiring capture-commit ancestry or deriving any semantic conclusion
