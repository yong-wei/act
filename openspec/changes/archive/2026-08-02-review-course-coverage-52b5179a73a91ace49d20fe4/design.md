## Batch review design

This change is a bounded execution unit for `52b5179a73a91ace49d20fe4` (`ctr:root-locus-engineering-v0.1::entityType:Formula`), sequence `0`, with `16` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews the 13 members that are profileOnly, new, changed, or highRisk; it does not decide the three non-risk members.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Execution result

The independent Primary session `87e9f5e7-efad-40fe-bcc4-cb12c4884ffb` produced 16 role-free `DEFER` decisions. The independent Challenger session `4802eede-3ae9-4095-9af6-1b3948d80e40` produced matching role-free `DEFER` decisions for the 13 required risk members; its broader raw review was deterministically restricted to that contract-required ordered subset before sealing. No semantic conflict required a Third review. The sealed receipt is `11e6c6dc5b35b172167f0a2c293ac9d9a4bd05681ba62d292cc89d1def7a7b66`; its detached attestation is `119e6304bc1ab308fa4169e2039077705c592ce455550abba912e99ea54eafb6`. The second publication was content-equivalent identical replay. The terminal review stage is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and no production selector or writer fence changed.
