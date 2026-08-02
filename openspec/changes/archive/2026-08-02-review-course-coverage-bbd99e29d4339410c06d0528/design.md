## Batch review design

This change is a bounded execution unit for `bbd99e29d4339410c06d0528` (`ctr:release:stability-analysis-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `1` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

The recorded execution keeps the two independent terminal Grok sessions bound to their raw sources: Primary `991b94cc-94d8-435e-b99a-4eceec7280c2` and Challenger `7aa9a3b2-4780-435f-817f-cdc585543b53`. Both sessions returned `0 INCLUDE / 0 EXCLUDE / 1 DEFER`, `evidenceSufficiency=INSUFFICIENT`, `role=null`, and no conflict. The source artifacts retain only repository-relative paths and preserve the ordered aggregate-evidence and canonical-profile selectors; diagnostic course candidates remain explicitly non-authoritative.

The normalized stage documents retain `reFreezeRequired=true` and the diagnostic-only candidate lists. The receipt carries the same re-freeze marker through both stage records, while the detached v2 attestation carries it directly. The v3 production-boundary proof records ordered protected-path snapshots, all production mutation flags false, and no ACTIVE or selector/writer-fence mutation. A second invocation with the same relative inputs returned `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`.
