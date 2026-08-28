## 1. Preconditions and denominator

- [x] 1.1 Verify the qualified `establish-modular-monolith-refactor-charter` and `enforce-modular-domain-dependency-contracts` inputs, source revision, owner, and dependency identity before implementation.
- [x] 1.2 Freeze the Course/Classroom denominator for every `ClassSession` writer/reader, runtime-first identity surface, generated-courseware launcher, media/knowledge-card lookup, authoring read, title fallback, and legacy session class.
- [x] 1.3 Reconcile the observed 32 runtime-first families and approximately 96 private route surfaces against filesystem, AST, registry, persistence, and browser evidence; record unexplained entries as blockers.
- [x] 1.4 Characterize current `course-runtime.ts`, `interactive-lesson-identity.ts`, `LessonPlan` mutation, session payload, generated publication/hash, media, and knowledge-card behavior without changing runtime code.

## 2. Immutable CourseBundle contract

- [x] 2.1 Define the immutable Course-owned bundle revision record and typed identity containing canonical lesson id, bundle id/revision, exact runtime release/tree/object locator, complete bundle digest, required per-resource hashes for lesson/manifest/handout/graph-overlay/knowledge-card/media, runtime source revision, identity-projection digest, and manifest hash.
- [x] 2.2 Add an expand migration and `ClassSession` binding that preserves the existing `LessonPlan`/BOPPPS relation, generated-courseware publication revision, and historical nullable rows.
- [x] 2.3 Add schema/data-quality checks proving a referenced bundle revision cannot be mutated in place, its complete digest covers all formal bundle content, and denormalized release/hash/resource fields equal the immutable revision.
- [x] 2.4 Define explicit legacy/incomplete and drift classifications; reject title-based or blanket historical rebinding and document the compatibility read boundary.

## 3. Runtime and session integration

- [x] 3.1 Extend the runtime export with a self-sufficient canonical lesson identity projection, exact runtime release/tree/object locator, complete bundle digest, required per-resource hashes, bundle revision, runtime source revision, and manifest hash.
- [x] 3.2 Migrate runtime/classroom reads away from the active release, authoring `lesson-id-map.json`, and title authority while retaining only bounded, explicitly classified ingress aliases.
- [x] 3.3 Update session creation to resolve and persist one qualified bundle revision and exact release locator atomically with plan, lesson snapshot, and generated-courseware binding.
- [x] 3.4 Verify ordinary and generated-courseware sessions reject canonical-id, release/tree/object locator, complete digest, per-resource hash, revision, runtime-source, or manifest-hash drift before creation/read.
- [x] 3.5 Bind lesson, manifest, handout, graph-overlay, media, and knowledge-card projections to the same revision/release identity and required hashes, with observable soft degradation for missing optional projections and hard failure for identity mismatch.

## 4. Vertical migration and deletion

- [x] 4.1 Migrate real session producers and readers in vertical slices, recording each caller, compatibility reader, owner, replacement, and deletion condition in the identity ledger.
- [x] 4.2 Remove authoring/title fallback and any duplicate identity authority only after the caller denominator reaches zero; do not delete or rewrite historical session identity.
- [x] 4.3 Publish a revision-bound migration/removal receipt and hand the qualified CourseBundle/session contract to `extract-classroom-session-application-service`.

## 5. Targeted, domain, and browser verification

- [x] 5.1 Add unit/schema/identity-drift tests for complete revisions, aliases, ambiguous identity, legacy classification, optional projections, and immutable binding.
- [x] 5.2 Add real-PostgreSQL tests for concurrent session creation, generated publication/hash equality, complete digest/per-resource hash equality, active-release switches after launch, plan changes after launch, and legacy rows remaining unchanged.
- [x] 5.3 Run ordinary and generated-courseware teacher/student browser journeys with refresh and an active runtime release/tree/object locator switch; verify captured bundle revision, locator, complete digest, manifest hash, and required resource hashes remain stable.
- [x] 5.4 Exercise missing optional media/card and mismatched projection cases in browser and report surfaces; verify soft degradation versus fail-closed drift.
- [x] 5.5 Run affected Course/Classroom domain suites, typecheck, and `openspec validate define-course-bundle-classroom-session-contract --type change --strict`, then `git diff --check`.
