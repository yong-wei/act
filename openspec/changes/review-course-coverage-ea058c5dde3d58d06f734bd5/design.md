## Batch review design

This change is a bounded execution unit for `ea058c5dde3d58d06f734bd5` (`ctr:root-locus-engineering-v0.1::entityType:DomainConcept`), sequence `0`, with `85` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews the manifest-selected `profileOnly`, `new`, `changed`, or `highRisk` members; it does not create a second verdict for non-risk members.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Executed record

The frozen slice was re-read at `integration` revision `b48e892e61167ed02435927a4a5e7595d2fa7dc5`: 85 ordered members, with 70 manifest-selected Challenger members. Primary recorded 6 `INCLUDE formal_objective` and 79 `DEFER`; Challenger recorded 70 `DEFER`. The shared risk slice had no semantic conflict, so no Third document is admitted. A Challenger model output also contained 15 non-risk opinions; they are omitted by the frozen manifest policy and recorded as an explicit scope projection in `review-provenance.json`.

The sealed receipt is `b287227204f4fbc0b38260bc10d6f1db23c9107edb69b0fb4bf26d999bb98cac`; its detached boundary attestation is `f9b24bfc8974b70877f6c7d56bbaf9fae7bf7a7316b9771870b16ce9ba333279`. First publication and an identical content-equivalent replay both passed. The terminal result remains `BLOCKED_UNRESOLVED_EVIDENCE`; no production selector, GraphRAG selector, writer fence, or CourseCoverage authority was changed.

The independent decision advisor accepted this scope: only the 70 frozen Challenger `requiredIds` enter the receipt, and Third is prohibited because that risk slice has zero conflict. Evidence-reference completion and the single unambiguous frozen identity correction are audit-only normalization; they do not alter a conclusion, role, sufficiency, or rationale.
