## Batch review design

This change is a bounded execution unit for `f699aa47a9afaf3057d4bc0e` (`ctr:release:system-modeling-engineering-v0.1::entityType:DomainConcept`), sequence `0`, with `265` exact ordered members from the frozen `batches[23]` manifest slice. The manifest policy requires Challenger for the `224` members with `profileOnly=true` or `riskFlags.highRisk=true`; the remaining `41` non-risk members are Primary-only. The member and worklist digests are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

### Independent stages

1. Primary produces an independent per-member conclusion and rationale for all 265 members.
2. Challenger independently reviews the 224 members required by the manifest risk policy.
3. A disagreement would require a terminal Third review; this batch has zero disagreements, so no Third source or normalized artifact is emitted.

No stage may reuse another stage's verdict as its own evidence. The Primary raw source is `course-content/authoring/knowledge/issue-1213-course-coverage-review/primary-independent-stage-source.json`, session `170364f7-6d6e-44d5-b936-96f8b6553af5`, SHA-256 `6660b119a1fec34754cb77a88b566e749be66e4025be223f222097fc067a620b`; the Challenger raw source is `course-content/authoring/knowledge/issue-1213-course-coverage-review/challenger-independent-stage-source.json`, session `4d714ca0-a746-4df4-939f-65a3a13dec78`, SHA-256 `9eb4b1c0c5d7e858672d33a3ecabb700fb91f0b902dd203e6fcb3f051c161fe9`. Each source is preserved byte-for-byte and bound through its normalized stage document and `review-provenance.json`. Published artifacts use logical repository-relative identifiers only; no raw, normalized, provenance, receipt, attestation, archive, or spec artifact may expose machine-local absolute paths.

Primary issued five `INCLUDE` decisions and 260 role-free `DEFER` decisions. Challenger issued 224 independent role-free `DEFER` decisions with `INSUFFICIENT` evidence, agreeing with Primary on every required member. The receipt therefore contains five `INCLUDE`, zero `EXCLUDE`, 260 `DEFERRED_EVIDENCE_BLOCKED` terminal members, zero conflicts, zero Third reviews, unresolved CourseCoverage authority, and aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`.

The five Primary-only INCLUDE decisions are the non-risk members with frozen independent-course evidence and valid roles/sufficiency. The required Challenger members remain aggregate/profile-only and any semantically related authoring observations outside their frozen selectors are diagnostic only. Upstream `#1180` must bind and classify accepted candidates as independent-course evidence and regenerate the frozen worklist/manifest before a later review can change this result.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, and manifestDigest. Any mismatch or canonical-revision drift fails closed. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary and Challenger stage outcomes, no Third stage, terminal per-member decisions, and proof that no out-of-slice member was written. `DEFER` is terminal for the review stage only; it maps to `DEFERRED_EVIDENCE_BLOCKED`, leaves CourseCoverage authority unresolved, keeps the aggregate gate `BLOCKED_UNRESOLVED_EVIDENCE`, and never writes `ACTIVE`, authority, selector, or writer state. The first publication uses the v3 protected-path snapshot and detached v2 attestation with receiptDigest `212e67d8400ac94e85c2dfedfa2c658f09d2516a9fc3e5e5f2db46d38fb55b8b` and attestationDigest `cb43e8a1bc76c7b2d6660435f76f5b727c52688a27f027edd92356f9208568be`; a second CLI run is `identical` with `replayMode=content-equivalent`.
