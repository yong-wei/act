## 1. Establish coherent governance inputs

- [ ] 1.1 Verify candidate import and `govern-actkg-release-set-deltas` are complete, then capture the accepted candidate ReleaseSet, Delta Receipt, runtime Projection digest and clean ACT Git/database watermark.
  - Blocked: clean checkpoint + real #1132 delta under clean protected paths.
- [x] 1.2 Generate a stable governance manifest: all current objects when no governed coverage baseline exists, or only added/changed/removed/invalidated identities for later releases with a valid baseline.
  - Evidence: unit governance work manifest tests.
- [ ] 1.3 Capture CourseCoverage authoring, the ACT structural-unit index and effective-resource inventory from the same revision and watermark.
  - Partial unit: structural index + capture identity model. Blocked: reviewed active authoring + clean inventory/delta capture.

## 2. Build and maintain course coverage

- [ ] 2.1 When no governed coverage baseline exists, review every candidate Release member and record exactly one allowed course role or `excluded_with_rationale` with source evidence and review identity.
  - Blocked: no reviewed active ledger (744 explicit review pending). Candidates only under `candidates/`.
- [x] 2.2 For later Deltas, review added and supported payload-changed objects, invalidate removed objects and revalidate unchanged dispositions without semantic recomputation.
  - Evidence: unit incremental merge + work-manifest scheduling.
- [ ] 2.3 Validate exhaustive current membership, unique object disposition, allowed role, rationale, evidence, ReleaseSet/Delta identity and coherent capture before import.
  - Partial: unit rejects candidate-generator/unbound markers and null deltaReceiptId; full active ledger still missing.
- [x] 2.4 Import CourseCoverage transactionally as shadow and prove roles do not create prerequisite, containment, sequence, association or other Teaching Projection edges.
  - Evidence: unit pipeline teachingProjectionEdgesCreated=false + Legacy selectors.
- [x] 2.5 Record a semantic no-op revalidation for packaging revisions without running object review.
  - Evidence: unit packaging no-op prior-identity tests.

## 3. Resolve upstream references to ACT structural units

- [x] 3.1 Consume immutable upstream RAG references without copying or rewriting their authority data.
  - Evidence: unit opaque upstream + classification of relation vs object.
- [x] 3.2 Implement deterministic stable-ID/hash alignment requiring source edition, structural unit/version/hash, inventory run, capture revision, atomic resource/segment and validation digest.
  - Evidence: unit complete-tuple / incomplete UNRESOLVED; relation upstream cannot validate.
- [x] 3.3 Generate node-driven semantic candidates against one versioned ACT structural-unit index when deterministic identity is unavailable.
  - Evidence: unit semantic candidates; empty index returns [].
- [x] 3.4 Run isolated evidence-bearing review and keep ambiguous, conflicting, unsupported or high-impact unresolved results out of published Crosswalks.
  - Evidence: unit ACCEPT needs inventoryAtomic; AMBIGUOUS stays UNRESOLVED.
- [x] 3.5 Re-run endpoint, version, hash, uniqueness, ReleaseSet/Delta and coherent-capture gates before shadow publication.
  - Evidence: unit validateCrosswalkForShadowPublication; VALIDATED requires canonicalId.
- [x] 3.6 Invalidate only Crosswalks affected by object, upstream Crosswalk or ACT structural-unit changes.
  - Evidence: unit invalidateCrosswalks.

## 4. Maintain canonical resource bindings

- [x] 4.1 Reuse #1124 object-change/resource-change candidate generation, review, dispute and publication contracts under the current ReleaseSet and Delta.
  - Evidence: governResourceBindings + same-run reverse index from VALIDATED Crosswalks unit test.
- [x] 4.2 Revalidate prior semantic work only when Canonical digest, resource/segment hash, role, prompt/reviewer version, evidence and structural gates remain valid.
  - Evidence: unit evaluateSemanticRevalidation.
- [x] 4.3 Invalidate only bindings affected by removed/changed objects, Crosswalks or resource segments, while preserving historical records.
  - Evidence: unit resource-changed pair invalidation.
- [x] 4.4 Publish accepted results only as `SHADOW_PUBLISHED` and prove RAG, recommendation, path, evidence and learning-fact production selectors remain Legacy.
  - Evidence: unit Legacy selector assertion.
- [x] 4.5 Produce an auditable summary of coverage, exclusions, unresolved items, Crosswalks, bindings, invalidations and no-op packaging revisions without protected content or local paths.
  - Evidence: unit summary safety.

## 5. Verify baseline and incremental governance

- [x] 5.1 Add unit/database tests for exhaustive baseline, Delta-scoped updates, coherent capture, opaque references, deterministic/semantic alignment, revalidation, invalidation and packaging no-op.
  - Evidence: unit suite 28 pass (candidate reject, relation classification, same-run binding). Postgres full baseline deferred on dirty capture.
- [ ] 5.2 Run baseline governance against the first accepted standard candidate and prove repeatability.
  - Blocked: clean checkpoint + reviewed active authoring + real #1132/#1124 inventory.
- [x] 5.3 Run synthetic later-release Deltas for object/relation/Crosswalk/component changes and verify only affected governance work is scheduled.
  - Evidence: unit incremental scheduling + same-run binding scoping.
- [ ] 5.4 Run targeted coverage/resource-binding suites, data-governance checks, typecheck, build and strict OpenSpec validation.
  - Partial: typecheck (heap-raised), prisma validate/generate, openspec strict, unit pass. Missing: build, data-governance, clean postgres.
- [x] 5.5 Update downstream readiness diagnostics: RAG consumes valid ACT Crosswalks, KAQ consumes CourseCoverage, SAR consumes reviewed bindings, and paths/facts/cutover still wait for formal Teaching Projection.
  - Evidence: projections downstreamReadiness + unit readiness diagnostics.
