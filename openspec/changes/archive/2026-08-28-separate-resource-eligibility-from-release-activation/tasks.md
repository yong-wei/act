## 1. Preconditions and denominator

- [x] 1.1 Verify `define-resource-identity-and-generated-registry-index` and `enforce-modular-domain-dependency-contracts` identities.
- [x] 1.2 Inventory all retrieval, path, binding, launch, qualification, Teaching Projection, and consumer-activation producers and callers across routes, APIs, models, scripts, tests, generated artifacts, and compatibility paths.
- [x] 1.3 Freeze current behavior for browse, recommendation, path, formal package, teacher preview, student launch, and engineering-only consumers, including reverse/dynamic callers.
- [x] 1.4 Map each old readiness-like status to its owner, evidence, consumer, scope, and deletion condition; do not merge statuses during characterization.

## 2. Independent eligibility contract

- [x] 2.1 Define `ResourceEligibilityContext` with role/user, course/scope, purpose, stage, Authority/resource-index identity, requested revision, and launcher contract.
- [x] 2.2 Define `ResourceEligibilitySnapshot` with independent retrieval readiness, path eligibility, formal binding, launch availability, formal release qualification, Teaching Projection activation, and consumer activation results.
- [x] 2.3 Define per-dimension statuses, evidence identities, bounded reasons, context hash, and policy for hard versus local soft failure.
- [x] 2.4 Prove the evaluator is a server-side read boundary with no selector, activation, completion, mastery, LearningFact, candidate-promotion, or PathNode write.

## 3. Existing-owner adapters

- [x] 3.1 Adapt R1 RegistryIndex/source/hash/version/scope identities and preserve source-owned launcher descriptors.
- [x] 3.2 Adapt ResourceNode/audit/path-readiness contracts without treating retrieval or binding as path eligibility.
- [x] 3.3 Adapt canonical binding and formal release qualification contracts without allowing `OPTIONAL`, `NONE`, prior shadow, or omission to bypass atomic closure.
- [x] 3.4 Read Teaching Projection and per-consumer activation through existing immutable readers; do not write or replace activation pointers.
- [x] 3.5 Enforce role, permission, scope, requested revision, retirement, and launcher checks with no candidate/legacy fallback.

## 4. Caller migration and deletion ledger

- [x] 4.1 Migrate representative browse/recommendation, path, launch, formal package, and knowledge-resource callers to the dimensioned read contract.
- [x] 4.2 Preserve local `unavailable`/`degraded` behavior for optional surfaces and fail closed for formal or required consumers.
- [x] 4.3 Record old aggregate readiness readers and any compatibility adapter with full consumers, zero-caller target, replacement identity, and rollback condition; do not retain a permanent facade.
- [x] 4.4 Hand all actual deletion candidates to `retire-superseded-resource-governance-entrypoints`.

## 5. Verification

- [x] 5.1 Add matrix tests for all seven dimensions and context-specific user/role/course/purpose/stage decisions.
- [x] 5.2 Add drift/retirement/permission/revision/launcher tests, formal hard-block tests, optional local-degradation tests, and engineering-only exception tests.
- [x] 5.3 Add no-write assertions for selectors, activation, learning evidence, completion/mastery, candidate promotion, and PathNode creation.
- [x] 5.4 Reconcile route/API/model/script/test/caller denominators and run the affected resource, path, knowledge, and teaching-projection suites plus `rtk npm run typecheck`.
- [x] 5.5 Run `rtk openspec validate separate-resource-eligibility-from-release-activation --type change --strict` and `git diff --check`.
