## Batch review design

This change is a bounded execution unit for `bdaa6aeec022a589b5f8fdb3` (`ctr:release:classical-control-design-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `500` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. An independent Primary source writer reviews every exact member and writes `primary-independent-stage-source.json` with an ordinal, member identity, conclusion, member-specific rationale, and evidence references.
2. An independent Challenger source writer reviews every member when any member is profileOnly, new, changed, or highRisk; it writes `challenger-independent-stage-source.json` without reading Primary or any other stage artifact. The source artifacts are the semantic stage authority; they are not assembled from a batch-level policy.
3. The assembler normalizes each source artifact into its stage review document, preserving the source conclusion, rationale, and evidence references while adding only runtime-required canonical decision/document digests.
4. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale.

No stage may reuse another stage's conclusion as its own evidence. The receipt records stage identity, input digests, per-member conclusion, rationale, and final review-stage status. Primary, Challenger, and Third use distinct reviewer and session identities.

### Review-stage conclusions

- `INCLUDE` requires sufficient independent current-course evidence and one of `formal_objective`, `necessary_prerequisite`, or `explicit_extension`.
- `EXCLUDE` requires sufficient independent current-course evidence and `excluded_with_rationale`.
- `DEFER` requires insufficient evidence and carries no CourseCoverage role. Its receipt status is `DEFERRED_EVIDENCE_BLOCKED`.

`DEFERRED_EVIDENCE_BLOCKED` closes the bounded review stage but does not resolve CourseCoverage authority. The member remains in the denominator, the aggregate Coverage gate remains blocked, and no DEFER result may enter CURRENT or ACTIVE. Deterministic code validates and assembles independently authored stage files; it never derives a conclusion from `profileOnly` or another risk flag.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage conclusions, conflict resolutions, terminal per-member review-stage states, and proof that no out-of-slice member was written. `stageRecords` is self-contained: for every present stage it preserves the complete independently authored stage document (reviewer identity, input digest, ordered per-member conclusion, evidence selectors, rationale, decision digest, and document digest), so each rationale is machine-readable and closes back to the stage digest. A receipt with any DEFER result is blocking input, not an accepted CourseCoverage overlay.

Before receipt assembly, the CLI captures the full Git `HEAD` and byte digests for the protected CourseCoverage selector, Canonical RAG selector, and LearningFact writer-fence paths and embeds that pre-publication proof plus a deterministic sibling `attestationPath` in the immutable receipt. The current publication boundary uses a v3 proof and v2 detached attestation: both persist ordered per-path protected-authority digest rows, and both snapshot digests are bound to those rows. The CLI then publishes the receipt, captures the true post-receipt snapshot, and publishes the detached sibling attestation. A v3 identical replay MUST load and validate both artifacts and their complete source/stage/receipt/attestation closure, compare every current protected-path byte and clean status with the persisted rows, and return the existing pair without requiring the capture commit object or performing capture-commit ancestry/blob lookup. This supports both descendant continuation and squash/content-equivalent continuation; protected-path dirty status, byte drift, or post-publication snapshot mismatch fails closed. Legacy v2 proof/v1 attestation pairs retain the previous readable capture-commit ancestry/blob replay checks, and old stage records without source-artifact binding are tolerated only on that already-published legacy replay path. When a new receipt was already published, the CLI attempts cleanup and surfaces cleanup failures rather than swallowing them. Review artifacts, the receipt, and its detached attestation are the only permitted writes; fixed mutation flags are accepted only as evidence-backed false values.

The generic review-stage terminality and detached-attestation contract already lives in `openspec/specs/current-course-coverage-review/spec.md`; this change's delta adds only the batch-specific binding and execution requirements.
