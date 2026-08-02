## Batch review design

This change is a bounded execution unit for `3c6973d82b44357efc73f2f8` (`ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:Formula`), sequence `0`, with `232` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The completed review preserves all 232 member records as role-free `DEFER` with insufficient evidence: there are no `INCLUDE`/`EXCLUDE` decisions, no semantic conflicts, and no Third stage.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. Primary and Challenger retain separately authored raw source artifacts whose hashes, paths, and writer sessions are bound into `primary-review.json` and `challenger-review.json`; `review-provenance.json` closes both writer sessions and records the independently verified absence of any Primary artifact access in the Challenger session log. Its repository-relative path, raw-byte SHA-256 `eee0d6dcbccab41287492f2feb7348a0419b62478d0be0565c509a9e97122a18`, stage closure, distinct sessions/scopes, `didNotReadPrimaryArtifact=true`, and zero audited Primary-path mentions are sealed into `reviewProvenanceBinding` and therefore into the immutable receipt digest. The Primary Grok session is `42eca660-ca20-49d4-b9df-93d9651ad3f2`; the Challenger Grok session is `37cc1c54-54d1-4cc0-a174-c440ed0294fe`. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status. The 232-member terminal review state is `DEFERRED_EVIDENCE_BLOCKED`; CourseCoverage authority remains unresolved and the global Coverage gate remains blocked.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, provenance binding, and proof that no out-of-slice member was written. The completed immutable pair is recorded by `receiptDigest` `2309285ee5acef97d6076135c8d9da29fbd642d1053e314b8f867e737a83c347` and detached `attestationDigest` `1fdf6b0398f01aa590f01e83cb48d834191d8ba9958fad77b603dc0b6a8c5d83`. It uses the v3 production-boundary proof and v2 detached-attestation schemas; an identical replay completed in `content-equivalent` mode without capture-commit ancestry dependence.
