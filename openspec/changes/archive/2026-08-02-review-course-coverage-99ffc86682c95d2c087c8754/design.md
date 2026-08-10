## Batch review design

This change is a bounded execution unit for `99ffc86682c95d2c087c8754` (`ctr:release:stability-analysis-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `174` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and review-stage terminal status. A `DEFER` conclusion is terminal only for this review stage: it remains role-free, leaves CourseCoverage authority unresolved, and blocks the aggregate coverage gate.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. Each normalized stage document binds the immutable independent stage-source artifact path, SHA-256, schema, stage, and writer session. Its v3 production-boundary proof and v2 detached attestation preserve ordered protected-path digests so identical replay remains verifiable after a squash merge without weakening the production authority fence.
