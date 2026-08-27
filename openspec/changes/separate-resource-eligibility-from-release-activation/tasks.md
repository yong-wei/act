## 1. Preconditions and denominator

- [ ] 1.1 Verify `define-resource-identity-and-generated-registry-index` and `enforce-modular-domain-dependency-contracts` identities.
- [ ] 1.2 Inventory all retrieval, path, binding, launch, qualification, Teaching Projection, and consumer-activation producers and callers across routes, APIs, models, scripts, tests, generated artifacts, and compatibility paths.
- [ ] 1.3 Freeze current behavior for browse, recommendation, path, formal package, teacher preview, student launch, and engineering-only consumers, including reverse/dynamic callers.
- [ ] 1.4 Map each old readiness-like status to its owner, evidence, consumer, scope, and deletion condition; do not merge statuses during characterization.

## 2. Independent eligibility contract

- [ ] 2.1 Define `ResourceEligibilityContext` with role/user, course/scope, purpose, stage, Authority/resource-index identity, requested revision, and launcher contract.
- [ ] 2.2 Define `ResourceEligibilitySnapshot` with independent retrieval readiness, path eligibility, formal binding, launch availability, formal release qualification, Teaching Projection activation, and consumer activation results.
- [ ] 2.3 Define per-dimension statuses, evidence identities, bounded reasons, context hash, and policy for hard versus local soft failure.
- [ ] 2.4 Prove the evaluator is a server-side read boundary with no selector, activation, completion, mastery, LearningFact, candidate-promotion, or PathNode write.

## 3. Existing-owner adapters

- [ ] 3.1 Adapt R1 RegistryIndex/source/hash/version/scope identities and preserve source-owned launcher descriptors.
- [ ] 3.2 Adapt ResourceNode/audit/path-readiness contracts without treating retrieval or binding as path eligibility.
- [ ] 3.3 Adapt canonical binding and formal release qualification contracts without allowing `OPTIONAL`, `NONE`, prior shadow, or omission to bypass atomic closure.
- [ ] 3.4 Read Teaching Projection and per-consumer activation through existing immutable readers; do not write or replace activation pointers.
- [ ] 3.5 Enforce role, permission, scope, requested revision, retirement, and launcher checks with no candidate/legacy fallback.

## 4. Caller migration and deletion ledger

- [ ] 4.1 Migrate representative browse/recommendation, path, launch, formal package, and knowledge-resource callers to the dimensioned read contract.
- [ ] 4.2 Preserve local `unavailable`/`degraded` behavior for optional surfaces and fail closed for formal or required consumers.
- [ ] 4.3 Record old aggregate readiness readers and any compatibility adapter with full consumers, zero-caller target, replacement identity, and rollback condition; do not retain a permanent facade.
- [ ] 4.4 Hand all actual deletion candidates to `retire-superseded-resource-governance-entrypoints`.

## 5. Verification

- [ ] 5.1 Add matrix tests for all seven dimensions and context-specific user/role/course/purpose/stage decisions.
- [ ] 5.2 Add drift/retirement/permission/revision/launcher tests, formal hard-block tests, optional local-degradation tests, and engineering-only exception tests.
- [ ] 5.3 Add no-write assertions for selectors, activation, learning evidence, completion/mastery, candidate promotion, and PathNode creation.
- [ ] 5.4 Reconcile route/API/model/script/test/caller denominators and run the affected resource, path, knowledge, and teaching-projection suites plus `rtk npm run typecheck`.
- [ ] 5.5 Run `rtk openspec validate separate-resource-eligibility-from-release-activation --type change --strict` and `git diff --check`.
