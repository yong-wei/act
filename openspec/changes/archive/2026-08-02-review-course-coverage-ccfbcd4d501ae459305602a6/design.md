## Batch review design

This change is a bounded execution unit for `ccfbcd4d501ae459305602a6` (`ctr:release:stability-analysis-engineering-v0.1::entityType:Formula`), sequence `0`, with `37` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale for all 37 frozen members.
2. Challenger independently reviews the manifest-selected risk slice. All 37 members are profileOnly/highRisk in this batch, so its required slice is the same 37 ordered members.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Recorded execution result

Both independently produced 37 role-free `DEFER` decisions with `INSUFFICIENT` evidence. No Primary/Challenger conclusion, role, or sufficiency conflict exists, so Third is not required. The terminal result remains review-stage completion only: the aggregate coverage gate is blocked pending independent-course authority evidence; no production selector or writer fence is changed.
