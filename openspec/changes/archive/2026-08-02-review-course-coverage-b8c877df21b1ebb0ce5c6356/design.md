## Batch review design

This change is a bounded execution unit for `b8c877df21b1ebb0ce5c6356` (`ctr:release:system-modeling-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `171` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

Primary and Challenger were produced by separate Grok sessions which did not read the counterpart artifact or conclusions. After PR #1253 identified insufficient evidence for the five prior Primary `INCLUDE` results, independent Primary remediation session `e0bc3434-6424-4782-88b5-a78fc7e18bf2` re-audited only ordinals `69,109,132,137,142` against their frozen selectors without reading Challenger or Third artifacts. It produced `primary-independent-stage-source.json` (SHA-256 `cbda7f5c7122f5d0b457a63de56a6cbc9bf7b199f1cad4833dc1e2b37e826044`) and v2 normalized digest `162ac8b0a4c5f3569bec61da996deffb6ba3c2e6936c0b92253963104c5ca59a`. Primary now records 0 `INCLUDE`, 171 role-free `DEFER`, and no `EXCLUDE`.

Challenger session `74224160-f779-4995-bf7e-6ae8e8105f26` produced `challenger-independent-stage-source.json` (SHA-256 `5a7521ced17491a3e325dd321468e3afe73074e194e53e031dd539192e5edc23`) and v2 normalized digest `f8c5ab643f335e77a681ceadc85c3c32a1eeb607e6c241a09fce3b4825ad65cc`. It independently reviewed every one of the 137 `profileOnly`/`highRisk` members, all as role-free `DEFER` with insufficient evidence. The five Primary `INCLUDE` members are outside that risk slice; therefore the required semantic comparison has zero conflicts and Third is forbidden.

No stage may reuse another stage's verdict as its own evidence. Both raw sources preserve each member's frozen evidence reference order, including exact evidence IDs. The 171-member frozen boundary contains 340 aggregate, 171 profile, and 55 independent-course evidence references; 34 members have independent-course evidence. The 137-member Challenger slice has no independent-course evidence, so it remains fail-closed.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger outcomes, and terminal per-member decisions. Remediation publication produced receipt digest `07ec146b188d5930d4df9a949d936aef97c32392f11bac25acfe496f9924b22a` and boundary-attestation digest `b97daff16ed3dbea169586e7a824304f184f168436d4d40db73bd6131af12f77`. It is review-stage terminal as `DEFERRED_EVIDENCE_BLOCKED`; all 171 members remain unresolved and the aggregate gate stays `BLOCKED_UNRESOLVED_EVIDENCE`. Replay is deterministic (`identical`, `content-equivalent`), and no production authority path was changed.
