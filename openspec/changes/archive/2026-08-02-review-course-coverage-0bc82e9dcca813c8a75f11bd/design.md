## Batch review design

This change is a bounded execution unit for `0bc82e9dcca813c8a75f11bd` (`ctr:release:discrete-time-control-analysis-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `4` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The independent review records all 4 members as role-free `DEFER` with insufficient evidence: there are no `INCLUDE`/`EXCLUDE` decisions, no semantic conflicts, and no Third stage.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. Primary and Challenger retain separately authored raw source artifacts whose hashes, paths, and writer sessions are bound into `primary-review.json` and `challenger-review.json`; `review-provenance.json` closes both writer sessions and explicitly records that Challenger did not read Primary. The Primary Grok session is `f03d0a8b-dec9-4c1f-b000-f7ae8c070810` and its raw source SHA-256 is `81ec958667e446bf34efb2ff337f6805c0a04964f6157fcf21bd4b3b92d7db45`; the Challenger Grok session is `e2ca2013-0c13-49a9-b33a-8f6ed92521eb` and its raw source SHA-256 is `e6dbc0e5ebe3ce493def6bbbd290f803c678ce61d2c9ae17cbd3475a368ae97d`. The review-stage terminal state is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the aggregate Coverage gate remains blocked.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. It binds the raw source artifacts, normalized stage documents, and provenance closure. The first publication completed with the v3 production-boundary proof and v2 detached-attestation pair: `receiptDigest` is `f86165449d3216c5d4b4ad5360b7383adeb7e7042fb526e101980251095b58e5` and `attestationDigest` is `5b3d39dbecf1e39470219c43225ea572846b8b6b5d2186a1db39ed54a63ee0f5`. Replay remains squash-safe through content-equivalent protected-path bytes and clean status without requiring capture-commit ancestry.
