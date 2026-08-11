## Batch review design

This change is a bounded execution unit for `f8917af6bf755caf058c5358` (`ctr:release:stability-analysis-engineering-v0.1|ctr:release:system-modeling-engineering-v0.1::entityType:Formula`), sequence `0`, with `1` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

For this batch, the member has one `priorDecisionRef` into aggregate active history. That reference is retained as provenance only: it is not independent course evidence, it cannot be inherited as a role or verdict, and it cannot authorize `INCLUDE` or `EXCLUDE`. With only aggregate/profile evidence, both independent stages therefore remain role-free `DEFER` with `INSUFFICIENT` evidence.

The independent re-review also observed semantically equivalent causal LTI convolution material in `course-content/authoring/lessons/3-1/design/3-1-handout.md` around lines 331-340 and `course-content/authoring/lessons/3-1/design/3-1-interactive-page.md` around line 449. Those authoring-side paths are diagnostic candidates only: they are absent from the frozen `#1180` worklist/manifest `evidenceRefs`, and the module3 unit-design-details path is not a classifier-accepted independent-course boundary. They therefore cannot change this frozen denominator or conclusion. Upstream `#1180` must bind and classify the candidates as independent-course evidence and regenerate the frozen worklist/manifest before a later `INCLUDE`/`EXCLUDE` re-review.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. `DEFER` is terminal for the review stage only; it maps to `DEFERRED_EVIDENCE_BLOCKED`, leaves CourseCoverage authority unresolved, keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and never writes `ACTIVE`, authority, selector, or writer state.
