## 1. Establish coherent governance inputs

- [x] 1.1 Verify candidate import and `govern-actkg-release-set-deltas` are complete, then capture the accepted candidate ReleaseSet, Delta Receipt, runtime Projection digest and clean ACT Git/database watermark.
  - Evidence (isolated PostgreSQL restored from pre-issue backup; verified code checkpoint `3a31d2614cf98c78db0e61158971a1eba94126d8`): v0.2 + standard v0.3-r2 candidate imported at historical clean capture `2d42a16a4f772297bb6ddcf5b15ae0011108fd8a`; accepted Delta `delta-receipt:d30d29958647f74dc25d7b11f24763945cad838d6ccf6d6e5ba2ef2b7630c98b` (`SEMANTIC_CONTENT_UPDATE`); governance capture `3a31d2614...`, import/delta capture `2d42a16a4...`; inventory `resource-binding-inventory:3a31d2614...:a8400e926...`; structural index `struct-index:484e8c8160e2bd8b`.
- [x] 1.2 Generate a stable governance manifest: all current objects when no governed coverage baseline exists, or only added/changed/removed/invalidated identities for later releases with a valid baseline.
  - Evidence: unit governance work manifest tests; OpenSpec incremental boundary retained (exact same-input baseline receipt/capture replay only, not generic re-baseline).
- [x] 1.3 Capture CourseCoverage authoring, the ACT structural-unit index and effective-resource inventory from the same revision and watermark.
  - Evidence: controlled active authoring + semantic reviews loaded under clean Git capture; inventory via `loadVerifiedPersistedCurrentInventory` pins persisted `dbWatermark`/`capturedAt` (no live LSN mint); structural index built from that inventory; dry-run and first apply shared one capture identity.

## 2. Build and maintain course coverage

- [x] 2.1 When no governed coverage baseline exists, review every candidate Release member and record exactly one allowed course role or `excluded_with_rationale` with source evidence and review identity.
  - Evidence (isolated DB first apply): membership 744 dispositions — formal_objective 85, necessary_prerequisite 53, explicit_extension 82, excluded_with_rationale 524; one `AggregateCourseCoverageVersion` (`automatic-control-aggregate-coverage-v1@1`) + 744 entries; controlled review identity (not heuristic auto-accept).
- [x] 2.2 For later Deltas, review added and supported payload-changed objects, invalidate removed objects and revalidate unchanged dispositions without semantic recomputation.
  - Evidence: unit incremental merge + work-manifest scheduling; packaging no-op path preserved.
- [x] 2.3 Validate exhaustive current membership, unique object disposition, allowed role, rationale, evidence, ReleaseSet/Delta identity and coherent capture before import.
  - Evidence: governance CLI + pure pipeline validated authoring against accepted Delta and coherent three-capture identity; offline validators and unit coverage gates; isolated apply imported only after validation.
- [x] 2.4 Import CourseCoverage transactionally as shadow and prove roles do not create prerequisite, containment, sequence, association or other Teaching Projection edges.
  - Evidence: unit pipeline teachingProjectionEdgesCreated=false + Legacy selectors; isolated readiness: teaching projection/path/facts/cutover blocked.
- [x] 2.5 Record a semantic no-op revalidation for packaging revisions without running object review.
  - Evidence: unit packaging no-op prior-identity tests; isolated harness packaging no-op with distinct import/delta captures.

## 3. Resolve upstream references to ACT structural units

- [x] 3.1 Consume immutable upstream RAG references without copying or rewriting their authority data.
  - Evidence: unit opaque upstream + classification of relation vs object.
- [x] 3.2 Implement deterministic stable-ID/hash alignment requiring source edition, structural unit/version/hash, inventory run, capture revision, atomic resource/segment and validation digest.
  - Evidence: unit complete-tuple / incomplete UNRESOLVED; relation upstream cannot validate.
- [x] 3.3 Generate node-driven semantic candidates against one versioned ACT structural-unit index when deterministic identity is unavailable.
  - Evidence: unit semantic candidates; empty index returns [].
- [x] 3.4 Run isolated evidence-bearing review and keep ambiguous, conflicting, unsupported or high-impact unresolved results out of published Crosswalks.
  - Evidence (isolated DB): 1121 controlled semantic reviews loaded; 1361 upstream refs unresolved → 1361 CURRENT/UNRESOLVED `ActGovernedStructuralUnitCrosswalk` rows; published VALIDATED Crosswalks: 0 (fail-closed gates; no auto-publish).
- [x] 3.5 Re-run endpoint, version, hash, uniqueness, ReleaseSet/Delta and coherent-capture gates before shadow publication.
  - Evidence: unit validateCrosswalkForShadowPublication; VALIDATED requires canonicalId; isolated apply published 0 VALIDATED.
- [x] 3.6 Invalidate only Crosswalks affected by object, upstream Crosswalk or ACT structural-unit changes.
  - Evidence: unit invalidateCrosswalks.

## 4. Maintain canonical resource bindings

- [x] 4.1 Reuse #1124 object-change/resource-change candidate generation, review, dispute and publication contracts under the current ReleaseSet and Delta.
  - Evidence: unit binding pipeline + publication gates; isolated first apply staged 0 candidates/decisions because no VALIDATED ACT Crosswalk satisfied the structural gate — expected fail-closed, not omitted execution (`CanonicalResourceBindingDecision` count 0).
- [x] 4.2 Revalidate prior semantic work only when Canonical digest, resource/segment hash, role, prompt/reviewer version, evidence and structural gates remain valid.
  - Evidence: unit evaluateSemanticRevalidation.
- [x] 4.3 Invalidate only bindings affected by removed/changed objects, Crosswalks or resource segments, while preserving historical records.
  - Evidence: unit resource-changed pair invalidation.
- [x] 4.4 Publish accepted results only as `SHADOW_PUBLISHED` and prove RAG, recommendation, path, evidence and learning-fact production selectors remain Legacy.
  - Evidence: unit Legacy selector assertion; isolated readiness: all production selectors unchanged on Legacy; SAR blocked without reviewed bindings.
- [x] 4.5 Produce an auditable summary of coverage, exclusions, unresolved items, Crosswalks, bindings, invalidations and no-op packaging revisions without protected content or local paths.
  - Evidence: unit summary safety; isolated summary/readiness: KAQ ready (220 covered / 524 excluded); RAG/SAR blocked; no protected content in diagnostics.

## 5. Verify baseline and incremental governance

- [x] 5.1 Add unit/database tests for exhaustive baseline, Delta-scoped updates, coherent capture, opaque references, deterministic/semantic alignment, revalidation, invalidation and packaging no-op.
  - Evidence: aggregate-governance + loaders + binding unit suites; `npm run test:aggregate-governance-postgres` (isolated schema/DB) covers exact-replay idempotency, packaging no-op, capture drift rejection, Legacy selectors; inventory pin/replay unit fences for persisted watermark.
- [x] 5.2 Run baseline governance against the first accepted standard candidate and prove repeatability.
  - Evidence (isolated PostgreSQL from pre-issue backup, production-shaped inputs): dry-run and first apply same receipt `agg-gov:a8f54493800384f6fbd089185c75386ca9e3e511023fc1f2dcab30dc37a69927`; first apply rows — 1 receipt, 1 coverage version, 744 entries, 1361 CURRENT/UNRESOLVED Crosswalks, 0 binding decisions (no VALIDATED Crosswalk → zero publications is correct fail-closed); immediate second apply `persisted.mode=idempotent` with same receipt and `automatic-control-aggregate-coverage-v1@1`. Not a production host deployment proof.
- [x] 5.3 Run synthetic later-release Deltas for object/relation/Crosswalk/component changes and verify only affected governance work is scheduled.
  - Evidence: unit incremental scheduling + same-run binding scoping; new Delta with baseline authoring fails closed (no generic re-baseline).
- [x] 5.4 Run targeted coverage/resource-binding suites, data-governance checks, typecheck, build and strict OpenSpec validation.
  - Evidence at verified code checkpoint `3a31d2614...`: `npm run test:unit` 641 files / 7674 tests passed (5 files / 13 tests skipped); `npm run test:data-governance` passed (knowledge-link isolated PG E2E passed; optional Redis/server branches skipped/degraded as before); `npm run test:aggregate-governance-postgres` passed; `npm run typecheck` passed; `npx prisma validate` passed; `NODE_MAX_OLD_SPACE_SIZE=8192 npm run build` passed (default 4 GiB OOM during Next TS phase; 8 GiB is successful evidence); `openspec validate govern-aggregate-course-coverage-and-resource-bindings --type change --strict` passed; `openspec validate --specs --strict` 189 passed / 0 failed.
- [x] 5.5 Update downstream readiness diagnostics: RAG consumes valid ACT Crosswalks, KAQ consumes CourseCoverage, SAR consumes reviewed bindings, and paths/facts/cutover still wait for formal Teaching Projection.
  - Evidence: projections downstreamReadiness + unit readiness diagnostics; isolated run: KAQ ready; RAG/SAR blocked; teaching projection/path/facts/cutover blocked; selectors Legacy.
