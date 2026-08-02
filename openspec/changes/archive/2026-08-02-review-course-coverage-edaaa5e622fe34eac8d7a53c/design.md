## Batch review design

This change is a bounded execution unit for `edaaa5e622fe34eac8d7a53c` (`ctr:root-locus-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `1` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written.

### Decision record: discovered course authority remains outside the frozen boundary

Both independent stages found that the 3-3 authoring and runtime handouts' `法则 1：起点与终点`, together with the 3-3/3-4 syllabus responsibility decision, independently support the root-locus statement. That evidence is semantically sufficient for a future inclusion decision, and `profileOnly`/`highRisk` are review triggers rather than automatic denial rules.

It is not, however, one of this frozen worklist item's `independent-course` evidence references. The current receipt validator permits a non-`DEFER` CourseCoverage role only when it cites such a frozen reference. This child therefore records the three course paths as candidate authority and produces `DEFER` without an active role. Issue #1180 must bind, classify, and re-freeze those sources before this canonical revision can receive an `INCLUDE` decision. The old aggregate `excluded` decision remains a prior reference only.

### Recovery decision: replace an untrusted source chain with new independent reviews

After the current validator rejected the original receipt for missing provenance binding, the retained raw PRIMARY and CHALLENGER transcripts were compared with their claimed source artifacts. Each transcript ended in `INCLUDE`, while its claimed independent source artifact recorded `DEFER`; the source artifacts therefore cannot serve as evidence that the stated DEFER decisions were independently authored. This is a provenance defect, not a basis for changing the frozen CourseCoverage authority.

Decision: discard that source chain on this unmerged branch and obtain two fresh, read-only, independent reviews against the unchanged frozen manifest/worklist and current receiver contract. The reconstruction may preserve only the fresh sessions' exact decisions, ordered selectors, evidence IDs, and rationales. It must not reuse the mismatching old source artifacts, create a role, bind candidate course paths, alter production authority, or introduce a compatibility allowlist. The current publisher then replaces the invalid receipt and attestation at their exact paths; a deterministic replay must report `identical`.
