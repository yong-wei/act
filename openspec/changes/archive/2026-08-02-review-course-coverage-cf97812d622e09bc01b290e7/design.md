## Batch review design

This change is a bounded execution unit for `cf97812d622e09bc01b290e7` (`ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:Formula`), sequence `0`, with `299` exact ordered members from the frozen `batches[19]` manifest slice. Every member is `profileOnly=true` and `riskFlags.highRisk=true`, so the manifest policy requires Challenger for all 299 members. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The Primary raw source is `primary-independent-stage-source.json`, session `1d8f2d19-41db-4479-a854-d7284f16fbe0`, SHA-256 `dcd30ca426b42ef2f8fa00215aada83a6c35234d8756c8e96279127aead1fbcb`; the Challenger raw source is `challenger-independent-stage-source.json`, session `ac434809-5488-46f9-a5ee-810a159ea56b`, SHA-256 `2e15a7477f3c8b8f34dd1166ae21f47ba1dd18ba524090f88187b76897027320`. Each source is preserved byte-for-byte and bound through the normalized stage document and `review-provenance.json`. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

Both stages independently issued all 299 decisions as role-free `DEFER` with `INSUFFICIENT` evidence. Their frozen evidence selectors contain only `aggregate` and `profile` references, with zero admitted `independent-course` evidence, so the stages agree on zero conflicts and no Third document is permitted. The receipt therefore has 299 `DEFERRED_EVIDENCE_BLOCKED` terminal members, `thirdRequired=false`, unresolved CourseCoverage authority, and aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`.

Each reviewer recorded possible semantic matches in authoring-side material outside the frozen selectors. Those observations are diagnostic only and cannot change this batch's denominator or conclusion. Upstream `#1180` must bind and classify accepted candidates as independent-course evidence and regenerate the frozen worklist/manifest before any later `INCLUDE`/`EXCLUDE` re-review.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. `DEFER` is terminal for the review stage only; it maps to `DEFERRED_EVIDENCE_BLOCKED`, leaves CourseCoverage authority unresolved, keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and never writes `ACTIVE`, authority, selector, or writer state. The publication proof uses the v3 protected-path snapshot and the detached v2 attestation; a second CLI run must be `identical` with `replayMode=content-equivalent`.
