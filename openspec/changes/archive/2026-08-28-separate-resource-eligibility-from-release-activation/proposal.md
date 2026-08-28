## Why

Resource readiness is currently observed through several legitimate contracts, but consumers can still read a readiness-like field as if it meant retrievable, path-eligible, formally bound, launchable, qualified for release, or activated. Those meanings have different evidence and authorities. Collapsing them causes recommendations to look like release decisions and makes an optional resource failure capable of blocking unrelated knowledge.

The system needs an explicit, context-bound eligibility decision that reports these dimensions independently. It must preserve the existing immutable Teaching Projection and Runtime Release/cutover authorities and must never turn a recommendation or eligibility result into a selector, completion, or mastery write.

## What Changes

- Define independent dimensions for retrieval readiness, path eligibility, formal binding, launch availability, formal release qualification, Teaching Projection activation, and consumer activation.
- Define a context containing the user/role, course scope, purpose, stage, Authority/resource-index identity, and requested revision; eligibility is a decision for that context, not a global resource flag.
- Feed eligibility from the generated `RegistryIndex`, ResourceNode/audit evidence, formal binding contracts, and existing release/activation readers without duplicating their authority.
- Enforce identity, permission, scope, revision, retirement, and launcher checks; drift fails closed for the affected consumer.
- Permit bounded degradation for ordinary browse, recommendation, and optional card/media surfaces while keeping formal gates strict.
- Make `OPTIONAL` and `NONE` diagnostic dispositions only; they cannot bypass atomic binding, qualification, or activation requirements.

## Capabilities

### New Capabilities

- `resource-eligibility-and-release-activation`: Defines the independent eligibility dimensions, context contract, failure behavior, and activation boundary.

### Modified Capabilities

None. Existing `resource-node-registry`, `canonical-knowledge-resource-binding`, `act-teaching-projection`, `versioned-knowledge-consumer-activation`, and `latest-authority-active-oss-resource-cutover` remain the owners of their respective evidence and activation contracts.

## Impact

- **Owners and denominator:** Characterize every readiness, eligibility, binding, launch, qualification, projection, and consumer-activation producer and consumer, including `src/lib/full-resource-path-readiness-gate.ts`, `resource-node-registry.ts`, `resource-field-completion-audit.ts`, `teacher-resource-node-data.ts`, `src/lib/teaching-projection/{contracts,builder,store,activation}.ts`, `runtime-active-release.ts`, path planning/recommendation code, Knowledge/ResourceNode routes, API handlers, Prisma `TeachingResource` reads, knowledge-cutover and data-governance scripts, and all direct unit/integration/browser tests. The implementation must publish a closed route/API/model/script/test/caller denominator, including reverse and compatibility callers.
- **Public target:** A server-side evaluator such as `evaluateResourceEligibility(context, resourceIndexEntry)` returns a versioned `ResourceEligibilitySnapshot` with one result per dimension, evidence identities, bounded reasons, and a context hash. It is a read contract, not a writer or selector.
- **Trust boundary:** Identity, role, scope, revision, retirement, formal binding, qualification, and activation checks are hard/contract gates. Browse/recommendation/optional-card presentation may degrade locally. Completion, mastery, LearningFact, selector, and activation writes remain outside this change.
- **Dependencies:** Requires `define-resource-identity-and-generated-registry-index` and therefore `enforce-modular-domain-dependency-contracts`. Existing Runtime Release/cutover and Teaching Projection activation remain authoritative; the tracking parent and release authority are not implementation dependencies.
- **Non-goals:** No bulk rebinding, Prisma schema change, selector/production activation, deploy, path-ranking redesign, learning-state mutation, or retirement/deletion of old entrypoints.
