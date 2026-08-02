## Batch review design

This change is a bounded execution unit for `c5f6b20a3a7cf9408e153b08` (`ctr:release:state-space-control-analysis-and-design-engineering-v0.1::entityType:KnowledgeStatement`), sequence `0`, with `500` exact ordered members from the frozen manifest slice. The `memberDigest`, worklist digests, and `manifestDigest` are immutable input keys; `786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8` is retained as the raw manifest artifact digest. The two preserved raw stage sources are `primary-independent-stage-source.json` (SHA-256 `1d73b98132805025405c1317ddc9e6129d71bee9e635799d37c672b378002260`, session `9abcc13d-1c7e-4e95-9664-9a9996876d16`) and `challenger-independent-stage-source.json` (SHA-256 `8d6888c4e45955f10f67be5226129c7e4bd774d39325449df8d2a022d52d8449`, session `7dc9f9ac-f9ac-4192-887e-393b9f555c7d`).

### Independent stages

1. Primary produces an independent per-member conclusion and rationale. Its normalized document is `primary-review.json`, with reviewInputDigest `fd2584e5493bb3edb8d6b74d18302ced846db3c602ee8733dcf74747c815d722` and documentDigest `0dbd967a30fd761ec4dedc7228db4dd42f0bb028e8c58d9223c9f4cf62b1733c`.
2. Challenger independently reviews every member when any member is profileOnly, new, changed, or highRisk; otherwise it follows the manifest policy and remains available for admitted primary exceptions. Here all 500 members require Challenger. Its normalized document is `challenger-review.json`, with reviewInputDigest `a4a590fad6dfdd9b1485ff7e921c208112e2ad309b5ec2759ca4c718f4f287ae` and documentDigest `af3c16c1414c71731a5dc2e48da648f7b7f13fd647662c99fcbe5c9e7aa6ea49`.
3. Any disagreement is routed to Third. Third's conclusion is terminal and must identify the conflict and rationale. This batch has zero semantic conflicts, so no Third artifact is emitted.

Both stages independently concluded `DEFER` for all 500 members. Frozen evidence contains 729 aggregate refs and 500 profile refs (1,229 total), with zero independent-course members. Nearby lesson and syllabus paths remain diagnostic-only; `reFreezeRequired=true` and Issue #1180 must bind/classify/re-freeze before a later INCLUDE/EXCLUDE review.

No stage may reuse another stage's verdict as its own evidence. The receipt records stage identity, input digests, per-member outcome, rationale, and final terminal status.

### Drift and authority fence

Before review and before receipt assembly, reread the manifest slice and compare batchId, sequence, semanticGroupKey, member count/order, memberDigest, worklistInputDigest, worklistDigest, manifestDigest, manifestArtifactSha256, and every canonical revision. Any mismatch or canonical-revision drift fails closed. All published paths, source bindings, provenance commands, and receipt references are repository-relative. This child does not alter production selectors, writer fences, or unrelated batches.

### Receipt

The receipt is deterministic and machine-mergeable: it contains the exact batch binding, ordered member references, Primary/Challenger/Third stage outcomes, conflict resolutions, terminal per-member decisions, and proof that no out-of-slice member was written. The first publication is `DEFERRED_EVIDENCE_BLOCKED` with receiptDigest `eaf06a0180e0d4b8acd4e35283a3d7baa546cef318a99855c03260a5beb12c65`, zero INCLUDE/EXCLUDE, 500 DEFER, zero conflicts, and zero Third reviews. It uses the v3 ordered protected-path proof and detached v2 attestation with attestationDigest `a5fe78541257603d477145aa7fe89056ad2f38c884d15b8ad2a0cd7052944066`; an identical second CLI invocation returns `publication=identical`, `attestationPublication=identical`, and `replayMode=content-equivalent`.
