## Batch review design

This change is a bounded execution unit for `babc4b83475400c53b2f46d7` (`ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:Formula`), sequence `0`, with `118` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The completed review preserves all 118 member records as role-free `DEFER` with insufficient evidence: there are no `INCLUDE`/`EXCLUDE` decisions, no semantic conflicts, and no Third stage.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. Primary and Challenger retain separately authored raw source artifacts whose hashes, paths, and writer sessions are bound into `primary-review.json` and `challenger-review.json`; `review-provenance.json` closes both writer sessions and explicitly records that Challenger did not read Primary. The Primary Grok session is `50b93f16-c3e7-4a45-b9d2-d9b9d65df0f2`; the Challenger Grok session is `221b9aa4-9a64-4698-9dd9-38b09e6f4332`. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status. The 118-member terminal review state is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the aggregate Coverage gate remains blocked.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. The completed immutable pair is recorded by `receiptDigest` `a6736d12049c2132a2d22fce2d7619e533200fec561e56eaf2809ae87d04cc6a` and detached `attestationDigest` `5888a709321f639dd5473f8ddc9c40b3df1851d015d0ae9387daa471e0ee28e7`. It uses the v3 production-boundary proof and v2 detached-attestation schemas; replay remains squash-safe through content-equivalent protected-path bytes and clean status without requiring capture-commit ancestry.
