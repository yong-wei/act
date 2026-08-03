## Batch review design

This change is a bounded execution unit for `58d1670455782297bdaf8a19` (`ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:SystemModel`), sequence `0`, with `50` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest.

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

On 2026-08-02, independent Grok Primary session `1b269d47-dd00-4387-8df7-75e7c5e1b8dc` and Challenger session `c2c5d056-edca-4486-9caa-99ad07aa3304` each covered the exact frozen order. Both returned 50 role-free `DEFER` decisions with insufficient evidence, no conflicts, and no Third review. The final current-runtime receipt `f0de14d9f28b9a0b397fc18cc84a677cc52834537028038a51a81cde773c8dae` and detached attestation `478df10397227d1ba543ea6ee04b5e4974c95d6c7276f6edb48a6c704f4d28c4` replay identically in content-equivalent mode. The review stage is terminal, while CourseCoverage authority remains unresolved and the production selector and writer fence remain unchanged.

### Post-integration provenance recovery

After the initial local-only publication, the branch non-rewritingly integrated the current CourseCoverage runtime, which requires a `reviewProvenanceBinding` in newly published receipts. The pre-integration receipt is not a historical allowlisted artifact and therefore cannot remain in the final artifact closure. The accepted recovery is to replace only the unpushed receipt, detached attestation, and incompatible provenance at the same artifact path in a new remediation commit. The immutable Git history retains the preliminary values; no remote artifact is overwritten.

The recovery derives the current provenance schema exclusively from the existing independent source artifacts, actual Grok session identities, source digests, and sealed normalized stage documents. It must not alter the 50 `DEFER` decisions, create an allowlist exception, modify the shared runtime, or create a parallel `-v2` artifact root. Publication and replay must establish the current provenance binding, receipt, stage records, detached attestation, and authority fence as one closed set.
