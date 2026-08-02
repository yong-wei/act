## Batch review design

This change is a bounded execution unit for `b8c877df21b1ebb0ce5c6356` (`ctr:release:system-modeling-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `171` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

Primary and Challenger were produced by separate Grok sessions which did not read the counterpart artifact or conclusions. Primary session `7b6f443d-fdf5-4e75-8764-6e7ab0e06341` produced `primary-independent-stage-source.json` (SHA-256 `18d2f61bce52e53ae3ddf5c1b7ee13738283111dc88f00d11b80118fb0ab8315`) and v2 normalized digest `3a7bac2e60f16bec46c35600702c4c43cd0d50d3c7fd05a9a79f1e12efd62526`. It reviewed all 171 ordered members: 5 `INCLUDE` with `formal_objective`, 166 role-free `DEFER`, and no `EXCLUDE`.

Challenger session `74224160-f779-4995-bf7e-6ae8e8105f26` produced `challenger-independent-stage-source.json` (SHA-256 `5a7521ced17491a3e325dd321468e3afe73074e194e53e031dd539192e5edc23`) and v2 normalized digest `f8c5ab643f335e77a681ceadc85c3c32a1eeb607e6c241a09fce3b4825ad65cc`. It independently reviewed every one of the 137 `profileOnly`/`highRisk` members, all as role-free `DEFER` with insufficient evidence. The five Primary `INCLUDE` members are outside that risk slice; therefore the required semantic comparison has zero conflicts and Third is forbidden.

No stage may reuse another stage's verdict as its own evidence. Both raw sources preserve each member's frozen evidence reference order, including exact evidence IDs. The 171-member frozen boundary contains 340 aggregate, 171 profile, and 55 independent-course evidence references; 34 members have independent-course evidence. The 137-member Challenger slice has no independent-course evidence, so it remains fail-closed.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger outcomes, and terminal per-member decisions. Publication produced receipt digest `69e717d7e04a5df90d6bc8ca4d3345730e6f5a2c09138875092f2bc622464366` and boundary-attestation digest `9dd7e4cbe523c21512bc308f6437729c861e2d667e53500e225bc96e9f54d131`. It is review-stage terminal as `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage remains unresolved and the aggregate gate stays `BLOCKED_UNRESOLVED_EVIDENCE`. Replay is deterministic (`identical`, `content-equivalent`), and no production authority path was changed.
