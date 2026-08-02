## Batch review design

This change is a bounded execution unit for `88b4b69695891faeed019fb2` (`ctr:release:time-domain-analysis-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `25` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Execution result

On 2026-08-02, independent Grok Primary session `5b170129-e739-41d1-95c6-3fd74dc51dd4` and Challenger session `799e0153-998c-43f7-a296-8c9b0d338dd8` each covered the 25-member frozen order. Both returned role-free `DEFER` decisions with insufficient evidence; there were no conflicts and no Third review. The current-contract receipt `8f35a2d4634aae6598adef2c98b5e6ce9b4fa218c9d9d15e714899b5e232579a` and detached attestation `8f67d78e6cde1e8afd9757dc77e19cfe42a4061a3bddaab79a493d1a73709ed0` replay identically in content-equivalent mode. CourseCoverage authority remains unresolved, and the production selector and writer fence remain unchanged.
