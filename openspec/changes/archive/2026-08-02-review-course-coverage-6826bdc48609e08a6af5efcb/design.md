## Batch review design

This change is a bounded execution unit for `6826bdc48609e08a6af5efcb` (`ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `10` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Recorded execution outcome

- Primary and Challenger were transcribed from independent raw sources without changing their semantic conclusions. The raw source SHA-256 values are `f8c69b836f4f6da30ea2f73df97ffe66b6c279747e79cc77ca87df407c71bbf5` and `52103ed1d7f63bba65428bed3f8d9fe4eaa69c53b5ac66420295e53784ace93c`; their normalized artifacts bind wrapper sessions `be3478ca-c446-46e6-b802-8faeb9079a93` and `72b3fcd8-acb6-49a9-a30f-3bd0147e5ba9`. The provenance record explicitly states that Challenger did not read Primary and carries the upstream unresolved re-freeze risk for course-material candidates omitted from frozen evidenceRefs.
- All 10 members remain `DEFER` with insufficient evidence; there are 0 `INCLUDE`, 0 `EXCLUDE`, 0 conflicts, and no Third artifact. The terminal status is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the aggregate gate remains blocked.
- The first publication emitted `batch-receipt.json` with receipt digest `1df6f45facd6a452f00ac2c7616f69750434ffa37630574c5736dd7ceb1067bc` and detached v2 attestation `batch-boundary-attestation.json` with attestation digest `c71e8312beef5626a25cf3934f587b4a7103790998828171d55b0a4b339af253`. Both publication runs proved all production mutation flags false.
- Replaying the same inputs returned `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`; the v3 production-boundary proof is paired with the detached v2 attestation. No production selector, writer fence, or current decision was changed.
