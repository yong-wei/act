## Batch review design

This change is a bounded execution unit for `84aa72597e8fe1d9ee6f0602` (`ctr:root-locus-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `1` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every required risk member; this batch's sole member is profileOnly/highRisk.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Execution result

The independent Primary session `5b2678f1-d651-4046-a1d1-6691280ac762` and independent Challenger session `853d6d16-a2e9-4161-b3a0-1f09c5421238` each returned the same role-free `DEFER` for the sole required member. No semantic conflict required Third. The sealed receipt is `54841a0bcdbb701a319ce6063762a93718f7b0d447030a254871928a65694e79`; its detached attestation is `258c676daf03752c272d201c2528fc0df2c9d5bff017ebe87161eb8649690c78`. The second publication was content-equivalent identical replay. The terminal review stage is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and no production selector or writer fence changed.
