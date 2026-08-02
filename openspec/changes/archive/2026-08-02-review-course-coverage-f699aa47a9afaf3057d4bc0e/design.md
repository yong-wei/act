## Batch review design

This change is a bounded execution unit for `f699aa47a9afaf3057d4bc0e` (`ctr:release:system-modeling-engineering-v0.1::entityType:DomainConcept`), sequence `0`, with `265` exact ordered members from the frozen `batches[23]` manifest slice. The manifest policy requires Challenger for the `224` members with `profileOnly=true` or `riskFlags.highRisk=true`; the remaining `41` non-risk members are Primary-only. The member and worklist digests are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale for all 265 members.
2. Challenger independently reviews the 224 members required by the manifest risk policy.
3. A disagreement would require a terminal Third review; this batch has zero disagreements, so no Third source or normalized artifact is emitted.

No stage may reuse another stage's verdict as its own evidence. The Primary raw source is `course-content/authoring/knowledge/issue-1213-course-coverage-review/primary-independent-stage-source.json`, session `170364f7-6d6e-44d5-b936-96f8b6553af5`, SHA-256 `7fa6c344c126a3ab608e2ebd72f92dd2bca8a978d87b3aa075228be0b3d58ee1`; the Challenger raw source is `course-content/authoring/knowledge/issue-1213-course-coverage-review/challenger-independent-stage-source.json`, session `4d714ca0-a746-4df4-939f-65a3a13dec78`, SHA-256 `36b9de0e261662e5c98d699d67c72756e33bf4c4398f9091be0de0857c3b0b54`. Each source is preserved byte-for-byte and bound through its normalized stage document and `review-provenance.json`. Published artifacts use logical repository-relative identifiers only; no raw, normalized, provenance, receipt, attestation, archive, or spec artifact may expose machine-local absolute paths.

Primary issued five `INCLUDE` decisions and 260 role-free `DEFER` decisions. Challenger issued 224 independent role-free `DEFER` decisions with `INSUFFICIENT` evidence, agreeing with Primary on every required member. The receipt therefore contains five `INCLUDE`, zero `EXCLUDE`, 260 `DEFERRED_EVIDENCE_BLOCKED` terminal members, zero conflicts, zero Third reviews, unresolved CourseCoverage authority, and aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`.

The five Primary-only INCLUDE decisions are the non-risk members with frozen independent-course evidence and valid roles/sufficiency. The required Challenger members remain aggregate/profile-only and any semantically related authoring observations outside their frozen selectors are diagnostic only. Upstream `#1180` must bind and classify accepted candidates as independent-course evidence and regenerate the frozen worklist/manifest before a later review can change this result.

The normalized Primary document preserves 856 raw evidence references, including 19 duplicate-selector groups (38 references) and 60 independent-course references. The normalized Challenger document preserves 659 raw evidence references. Every decision carries `evidenceIds` aligned one-to-one with `evidenceSelectors` and the raw reference order. Repeated selectors are disambiguated only by their frozen `evidenceId`; selector-only lookup MUST fail closed rather than overwrite or collapse distinct references. The normalized document digests are Primary `36e89f247d2924a4b72b9d05746fe11c0026c91f2d40ce227fd7dede1a1c2b04` and Challenger `7801070f4a3af787a0cbaf05e99b0ae95efd16250796e071cd3ae99073719366`.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary and Challenger stage outcomes, no Third stage, terminal per-member decisions, and proof that no out-of-slice member was written. Stage records retain every `evidenceId`/selector pair, including repeated selectors, so selector-only ambiguity cannot overwrite frozen identity. `DEFER` is terminal for the review stage only; it maps to `DEFERRED_EVIDENCE_BLOCKED`, leaves CourseCoverage authority unresolved, keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and never writes `ACTIVE`, authority, selector, or writer state. The first publication uses the v3 protected-path snapshot and detached v2 attestation with receiptDigest `0aa13e81b6b322c43f0565b8a0e53c7e18e48e5fbad3d1972198e56f69ebc66e` and attestationDigest `c1d7eed3423cab07a55273742c108eb462f04f83a1f20dafd15bea3f2210bed7`; a second CLI run is `identical` with `replayMode=content-equivalent`.
