## Batch review design

This change is a bounded execution unit for `b354cb02317e7a7f534c0208` (`ctr:release:system-modeling-engineering-v0.1::entityType:Formula`), sequence `0`, with `204` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The capture HEAD is `f68954f62b098e18aa728dea0cae5e98fea3de4f`.

### Independent stages

1. Primary (`fd2080b4-43de-43e0-862d-272b84300271`) produces an independent per-member conclusion and rationale for all `204` members. Every member is `DEFER` with insufficient evidence.
2. Challenger (`bca2c71c-055d-4a2f-875b-7fb9e4ec8a77`) independently reviews the shared risk slice: `202` members selected by `profileOnly || new || changed || highRisk`. Frozen non-risk ordinals `2` and `24` are omitted from Challenger stage decisions but remain in the full batch binding and receipt.
3. Any disagreement is routed to Third. No disagreement occurred, so Third is absent. The terminal receipt remains `DEFERRED_EVIDENCE_BLOCKED` for all `204` members.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. The first publication produced receipt digest `ddde95cd1ead7719aba464043941f05b096eff3c76f80500e94f768e7f7e9b66` and detached boundary attestation digest `9fdce2d23a9fb9b3003bdb6c9d7cf36119597d2eae8d7afa46b09744b018ccd0`; replay returned `identical` with `content-equivalent` mode. The three frozen independent-course references are coarse `heading:传递函数` selectors and are insufficient for formula-level authority, so #1180 re-freeze remains required and all production mutation flags remain false.
