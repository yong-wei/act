## Why

The current CourseCoverage review denominator is frozen in a deterministic manifest. This child executes exactly one frozen batch and is blocked by GitHub issue #1180; the parent relation is GitHub issue #1173. Both native relations are created by the main thread.

## What Changes

- Review only this manifest batch with independent Primary and Challenger conclusions.
- Route every disagreement to a Third reviewer; Third MUST produce the terminal conclusion.
- Require Challenger for all 284 profileOnly/highRisk KnowledgeStatement members in this batch.
- Preserve both raw stage sources byte-for-byte, bind normalized stage documents and provenance to their source SHA-256 and writer sessions, and emit the v3 production-boundary receipt with the v2 detached attestation.
- Emit a machine-mergeable batch decision receipt and preserve all input, stage, and replay digests.
- Fail closed on any member, digest, or revision drift.

## Batch Binding

- `change_id`: `review-course-coverage-beffdbc7a6d3d2c54714760b`
- `batchId`: `beffdbc7a6d3d2c54714760b`
- `manifestBatchIndex`: `21`
- `sequence`: `1`
- `semanticGroupKey`: `ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`
- `memberCount`: `284`
- `memberDigest`: `b36ed7c808c9e08302bdb20ade5a7a22520ee5983fe61ea2a7ff8813c62305a6`
- `worklistInputDigest`: `55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2`
- `worklistDigest`: `bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489`
- `manifestDigest`: `2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818`
- `manifestArtifactSha256`: `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8`
- `exactOrderedMembers`: `batch-manifest.json#/batches/21/members`
- `primarySessionId`: `c9fc299b-f408-4b33-a927-6ee7d0e8c057`
- `primaryRawSha256`: `1849fe4c185d97b2173123108ec9494aba4e063580a60b7bddacbaa6f35d48bc`
- `challengerSessionId`: `42e536dd-c725-4efd-857f-20b2f84a27da`
- `challengerRawSha256`: `bb23cbb5bb066d7ba0442207a7cb34ab25277f89d0e0347b7b7fd91fbcd41cc0`

The manifest slice above is the sole member source; this proposal does not copy the full member list into prose.

## Scope

Only the exact ordered members in the frozen slice are eligible. Each member keeps its canonical ID and canonical revision from the slice. Primary and Challenger review the same ordered slice independently; conflicts go to terminal Third review. The decision receipt is keyed by all fields above.

The assembled outcome is 284 role-free `DEFER` decisions from Primary and 284 independently authored `DEFER` decisions from Challenger, with zero semantic conflicts and no Third stage. Every frozen evidence reference is limited to the `aggregate` or `profile` boundary; no member has admitted independent-course evidence. Any semantically related authoring material found by either reviewer is diagnostic only. Upstream issue `#1180` must bind and classify such candidates as independent-course evidence and re-freeze the worklist/manifest before a later review can change this result. Published artifacts use logical repository-relative identifiers only; they MUST NOT expose machine-local absolute paths.

## Out of Scope

No other batch, no stale or historical batch interpretation, no aggregate denominator rewrite, no production selector or writer-fence change, no automatic CURRENT decision, and no GitHub relationship mutation in this child.

## Impact

Adds one review-child contract and its decision receipt shape. It does not mutate production CourseCoverage authority.
