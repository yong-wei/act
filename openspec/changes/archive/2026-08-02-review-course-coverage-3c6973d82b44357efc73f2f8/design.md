## Batch review design

This change is a bounded execution unit for `3c6973d82b44357efc73f2f8` (`ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:Formula`), sequence `0`, with `232` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The completed review preserves all 232 member records as role-free `DEFER` with insufficient evidence: there are no `INCLUDE`/`EXCLUDE` decisions, no semantic conflicts, and no Third stage.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. Primary and Challenger retain separately authored raw source artifacts whose hashes, paths, and writer sessions are bound into `primary-review.json` and `challenger-review.json`; `review-provenance.json` closes both writer sessions and records the independently verified absence of any Primary artifact access in the Challenger session log. The Primary Grok session is `42eca660-ca20-49d4-b9df-93d9651ad3f2`; the Challenger Grok session is `37cc1c54-54d1-4cc0-a174-c440ed0294fe`. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status. The 232-member terminal review state is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the global Coverage gate remains blocked.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. The completed immutable pair is recorded by `receiptDigest` `09162ee3c9fdd879bd345f75e3ff67a61fcbf1c469bab109b3b20fee61fb5ac1` and detached `attestationDigest` `68597747729284c179171cc1b414721388df9cd89e1684e54d2590c8de0a51e8`. It uses the v3 production-boundary proof and v2 detached-attestation schemas; an identical replay completed in `content-equivalent` mode without capture-commit ancestry dependence.
