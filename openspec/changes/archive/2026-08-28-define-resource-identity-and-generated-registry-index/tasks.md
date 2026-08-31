## 1. Preconditions and denominator

- [x] 1.1 Verify the qualified `enforce-modular-domain-dependency-contracts` input and current OpenSpec capability owners.
- [x] 1.2 Inventory every resource registry entry, metadata row, ResourceNode/audit projection, published resource artifact, source adapter, route/API, Prisma model read, script, generated output, test, compatibility path, direct caller, and reverse caller.
- [x] 1.3 Record the complete foreign-identity matrix for `registryId`, Prisma `TeachingResource.id`, runtime lesson/media identity, Canonical ID, ResourceNode ID, and formal binding ID; prove that no pair is being treated as an alias.
- [x] 1.4 Freeze current render, launch, authorization, revision, and optional-failure behavior for representative course, card, media, simulation, textbook, and knowledge-node consumers.

## 2. Identity and descriptor contract

- [x] 2.1 Define `ResourceIdentity` with deterministic `(sourceKind, sourceRef, sourceVersion, contentHash, scope)` closure and a separately versioned launcher-contract identity.
- [x] 2.2 Define `ResourceDescriptor`, foreign-reference fields, bounded availability states, and source-owned launcher descriptors without raw content, internal paths, signed URLs, or guessed routes.
- [x] 2.3 Define `SourceAdapter` ownership, input-capture, output-schema, and error contracts; reject unowned, duplicate, ambiguous, or drifted inputs.
- [x] 2.4 Keep `resource-registry.tsx` as render owner and document the non-overlap with the manifest plugin registry, DB `TeachingResource` registry, ResourceNode registry, and lesson-engine renderers.

## 3. Deterministic RegistryIndex

- [x] 3.1 Implement a read-only builder that composes declared source adapters and published artifacts without scanning successful output as a source.
- [x] 3.2 Canonically sort and serialize entries, bind source revision/artifact identity, generator version, launcher contracts, and output digest, and prove same-input byte identity.
- [x] 3.3 Emit local `available`, `degraded`, or `unavailable` status for optional resources; fail closed on required identity, duplicate, capture, hash, version, scope, or launcher errors.
- [x] 3.4 Compare the generated descriptors with existing resource consumers and record any duplicate hand-written table slated for deletion, without deleting an owner or adding a facade.

## 4. Consumer migration and verification

- [x] 4.1 Migrate one bounded resource/knowledge consumer through the public index and preserve server-side role, authorization, revision, and launcher checks.
- [x] 4.2 Add tests for identity collisions, foreign-id separation, source drift, deterministic regeneration, adapter coverage, optional failure isolation, route safety, and base knowledge availability.
- [x] 4.3 Reconcile production/test/generated/compatibility caller denominators and prove every indexed entry has one owner and one status.
- [x] 4.4 Run affected resource, knowledge, and route contract suites plus `rtk npm run typecheck`.
- [x] 4.5 Run `rtk openspec validate define-resource-identity-and-generated-registry-index --type change --strict` and `git diff --check`.

## 5. Handoff and deletion boundary

- [x] 5.1 Publish the RegistryIndex identity, source/artifact closure, foreign-identity matrix, optional-status matrix, caller denominator, and migration ledger.
- [x] 5.2 Hand the index contract to `separate-resource-eligibility-from-release-activation` and `consolidate-versioned-knowledge-surface-read-contracts` without activating either consumer.
- [x] 5.3 Leave retirement of superseded identity/registry-read/projection entrypoints to `retire-superseded-resource-governance-entrypoints`, gated by its independent denominator and rollback evidence.
