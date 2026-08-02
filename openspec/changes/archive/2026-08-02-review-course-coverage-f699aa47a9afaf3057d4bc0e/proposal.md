## Why

The current CourseCoverage review denominator is frozen in a deterministic manifest. This child executes exactly one frozen batch and is blocked by GitHub issue #1180; the parent relation is GitHub issue #1173. Both native relations are created by the main thread.

## What Changes

- Review only this manifest batch with independent Primary conclusions for all 265 members and Challenger conclusions for the 224 profileOnly/highRisk members required by the manifest policy.
- Preserve both raw stage sources byte-for-byte, bind normalized stage documents and provenance to their source SHA-256 and writer sessions, and emit the v3 production-boundary receipt with the v2 detached attestation.
- Preserve the five Primary-only INCLUDE decisions for the 41 non-risk members; the 224 required Primary/Challenger members agree on role-free DEFER, so no Third stage is emitted.
- Emit a machine-mergeable batch decision receipt and preserve all input, stage, and replay digests.
- Fail closed on any member, digest, or revision drift.

## Batch Binding

- `change_id`: `review-course-coverage-f699aa47a9afaf3057d4bc0e`
- `batchId`: `f699aa47a9afaf3057d4bc0e`
- `manifestBatchIndex`: `23`
- `sequence`: `0`
- `semanticGroupKey`: `ctr:release:system-modeling-engineering-v0.1::entityType:DomainConcept`
- `memberCount`: `265`
- `memberDigest`: `e026fadcfcdfdd5798b11f76bf9e7e5eed23f548756457850e344909782fd852`
- `worklistInputDigest`: `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`
- `worklistDigest`: `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`
- `manifestDigest`: `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`
- `manifestArtifactSha256`: `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`
- `exactOrderedMembers`: `batch-manifest.json#/batches/23/members`
- `primarySessionId`: `170364f7-6d6e-44d5-b936-96f8b6553af5`
- `primaryRawSha256`: `7fa6c344c126a3ab608e2ebd72f92dd2bca8a978d87b3aa075228be0b3d58ee1`
- `challengerSessionId`: `4d714ca0-a746-4df4-939f-65a3a13dec78`
- `challengerRawSha256`: `36b9de0e261662e5c98d699d67c72756e33bf4c4398f9091be0de0857c3b0b54`
- `normalizedStageSchema`: `current-course-coverage-stage-review/v2`
- `primaryNormalizedDigest`: `c34537f9f429a7a9e2d2c9c8636f7b91d85afa0c172133c0e2a33f59e9cd33b7`
- `challengerNormalizedDigest`: `47ed0e2ba256599dc85c0d4d351210598e50997dcc07ddec90d6e18c00389bc5`
- `receiptDigest`: `eb3451fbf5b5938676f69eb9e25577bd02e6ce9435dff53b52dee4dbefdaca08`
- `attestationDigest`: `efcf9c750c644673b69038a16e84a5ad1056817785556ae5b20de075207bec32`

The manifest slice above is the sole member source; this proposal does not copy the full member list into prose.

## Scope

Only the exact ordered members in the frozen slice are eligible. Each member keeps its canonical ID and canonical revision from the slice. Primary reviews all 265 members; Challenger reviews the 224 members whose manifest risk surface requires a second stage. The decision receipt is keyed by all fields above.

The assembled outcome is five Primary-only `INCLUDE` decisions for non-risk members and 260 Primary `DEFER` decisions. The required Challenger stage independently agrees on all 224 risk members as role-free `DEFER` with `INSUFFICIENT` evidence. There are zero semantic conflicts and no Third stage. Frozen aggregate/profile evidence remains non-authoritative; any semantically related authoring material outside the frozen references is diagnostic only. CourseCoverage authority remains unresolved and the aggregate gate remains blocked pending upstream issue `#1180`.

Normalized decisions use `current-course-coverage-stage-review/v2` and preserve every raw `evidenceRefs` entry in order as paired `evidenceSelectors` and exact frozen `evidenceIds`. `v1` remains accepted only for replay of existing published artifacts; newly assembled stage documents MUST use `v2`, and `v2` documents with repeated selectors MUST carry exact `evidenceIds`. When a selector repeats within one member, the receipt MUST use the evidence ID to identify the intended frozen reference; selector-only ambiguity MUST NOT overwrite or collapse evidence identity. Primary contains 856 frozen references, including 19 duplicate-selector groups (38 references) and 60 independent-course references; Challenger contains 659 identity-bound frozen references.

## Out of Scope

No other batch, no stale or historical batch interpretation, no aggregate denominator rewrite, no production selector or writer-fence change, no automatic CURRENT decision, and no GitHub relationship mutation in this child.

## Impact

Adds one review-child contract and its decision receipt shape. It does not mutate production CourseCoverage authority.
