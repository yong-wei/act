## Batch review design

This change is a bounded execution unit for `00617fd6a22c8b84c2e91142` (`ctr:release:time-domain-analysis-engineering-v0.1::entityType:DomainConcept`), sequence `0`, with `147` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The completed review preserves all 147 members as role-free `DEFER` with insufficient evidence: there are no `INCLUDE`/`EXCLUDE` decisions, no semantic conflicts, and no Third stage.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. Primary and Challenger wrote distinct byte-preserved raw sources before normalization: `primary-independent-stage-source.json` SHA-256 `badd7133b6def73105ac3460fa3bc2b4e6e109351adab6526dcaf08b17e30d24` from Grok session `b76983ed-6bbe-448a-a688-0d320e8a85c2`, and `challenger-independent-stage-source.json` SHA-256 `396a10272b989ddffb45bd7e8c9a3af2a9edc68e941fa8f644a6ae6a2b89906f` from distinct Grok session `f068c4e1-ee97-4b4b-a448-02bc1a0f476a`. `review-provenance.json` binds those sources, their distinct scopes, normalized v2 documents, and the Challenger non-read audit (`didNotReadPrimaryArtifact=true`, zero audited Primary-path mentions). The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, `reviewProvenanceBinding`, and proof that no out-of-slice member was written. The completed publication uses the v3 production-boundary proof and v2 detached-attestation pair, with receipt digest `96aac13889ab93e08b88217964564a72f2b41ce96f5806b083253a29479d7728`, detached attestation digest `de22a1e620e0c4f12cbe1a67b49319bfc861e274a8bd12388033e57dcac29647`, and provenance byte digest `0a98d12f41dcc3045c007d4bb226ec8e23c31a280da66d5e87f62177c585d27a`. A second assembly produced an identical content-equivalent replay.
