## Batch review design

This change is a bounded execution unit for `5b8e00646810a496b097f9a9` (`ctr:release:time-domain-analysis-engineering-v0.1::entityType:Formula`), sequence `0`, with `55` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Batch locator correction

The issue body originally named `batch-manifest.json#/batches/0/members`, but that index resolves to an unrelated 96-member batch. The immutable identity fields above resolve uniquely to `batch-manifest.json#/batches/27/members`. The issue locator is corrected before review; it is a documentation correction only and does not alter the batch ID, frozen members, revisions, or digests. The batch ID plus all binding digests remain the governing authority, while index `27` is the manifest-local audit locator.

### Executed evidence

Primary source `primary-independent-stage-source.json` was produced by Grok session `4c070f03-56e8-45c0-af4d-b5eace9d6c1f`; Challenger source `challenger-independent-stage-source.json` was independently rebuilt after stopping and removing a contaminated concurrent attempt, using only Grok session `64990fe6-9819-4e36-9fc2-187721a60246`. Both sources cover the same 55 frozen members in order, retain all 115 frozen evidence references, and record `DEFER` with `INSUFFICIENT` evidence for every member because no frozen reference has boundary `independent-course` (60 are aggregate and 55 are profile evidence). Their normalized document digests are respectively `1144d4bdaf3abb8d1d3e1ce1ece77c62a2af29aa4a8b6de57f45b576ca9b93ef` and `7d87c975231a05bf8de2be080e9edb4a8212e6e83f01e50e535194f7582f6fd4`; therefore no Third stage is required.

The deterministic publication generated receipt `47fd33f8a8e06ab4da2bb52e0fa29d5ad7241534354ca98522cf3094f8a60d3d` and detached attestation `33ae59cea6a25aa887f0da50fbc766160f8dbe767e6593b795bce61674081f91`. Its second run was content-equivalent, with no production authority mutation and terminal review-stage status `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the aggregate gate remains blocked.
