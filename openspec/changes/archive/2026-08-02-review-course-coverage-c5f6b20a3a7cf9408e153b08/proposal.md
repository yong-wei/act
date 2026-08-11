## Why

The current CourseCoverage review denominator is frozen in a deterministic manifest. This child executes exactly one frozen batch and is blocked by GitHub issue #1180; the parent relation is GitHub issue #1173. Both native relations are created by the main thread.

## What Changes

- Review only this manifest batch with independent Primary and Challenger conclusions.
- Route every disagreement to a Third reviewer; Third MUST produce the terminal conclusion.
- Require Challenger for profileOnly, new, changed, or highRisk members.
- Emit a machine-mergeable batch decision receipt and preserve all input digests.
- Fail closed on any member, digest, or revision drift.

## Batch Binding

- `change_id`: `review-course-coverage-c5f6b20a3a7cf9408e153b08`
- `batchId`: `c5f6b20a3a7cf9408e153b08`
- `manifestBatchIndex`: `20`
- `sequence`: `0`
- `semanticGroupKey`: `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`
- `memberCount`: `500`
- `memberDigest`: `81fedba91c18ba7fbb40e3575e96445135485bfbd6af9c1c8fc5bd82bfba5f49`
- `worklistInputDigest`: `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`
- `worklistDigest`: `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`
- `manifestDigest`: `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`
- `manifestArtifactSha256`: `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`
- `exactOrderedMembers`: `batch-manifest.json#/batches/20/members`

The manifest slice above is the sole member source; this proposal does not copy the full member list into prose.

## Scope

Only the exact ordered members in the frozen slice are eligible. Each member keeps its canonical ID and canonical revision from the slice. Primary and Challenger review the same ordered slice independently; conflicts go to terminal Third review. The decision receipt is keyed by all fields above.

## Out of Scope

No other batch, no aggregate denominator rewrite, no production selector or writer-fence change, no automatic CURRENT decision, and no GitHub relationship mutation in this child.

## Impact

Adds one review-child contract and its decision receipt shape. It does not mutate production CourseCoverage authority.
