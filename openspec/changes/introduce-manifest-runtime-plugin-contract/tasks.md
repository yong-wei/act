## 1. Preconditions and denominator

- [ ] 1.1 Verify the qualified charter and dependency-contract inputs together with the interactive-module taxonomy, response, generated-courseware, and active UI capabilities.
- [ ] 1.2 Freeze the canonical and legacy module-kind/capability pairs, capability versions, activity and layout registries, central switch branches, direct renderer imports, generated-slide adapters, role projections, evidence paths, and missing-renderer contracts.
- [ ] 1.3 Characterize the pilot `compute.panel` / `static-surface-3d` HTML, student/teacher projections, evidence classification, and optional-failure behavior without changing runtime code.

## 2. Typed plugin boundary

- [ ] 2.1 Define typed module, activity, and layout/template plugin contracts with a stable composite key of category, `module.kind`, non-empty `capabilityRef`, and contract version; schema, role projection, evidence, and missing-renderer behavior belong to the contract.
- [ ] 2.2 Compose registries from explicit owners, accept distinct capabilities under one `module.kind`, and reject duplicate full keys, unknown categories/references, missing versions, and lesson-private validation dependencies.
- [ ] 2.3 Reduce the central manifest runtime to manifest validation, exact-key lookup, shared render/submission context, and typed missing-renderer handling; remove capability parsing and capability-specific branches.
- [ ] 2.4 Keep role projection and evidence extraction side-effect free until the shared submission path accepts the declared typed evidence.

## 3. Real renderer migration

- [ ] 3.1 Move the actual `compute.panel`/`static-surface-3d` implementation into its owned plugin keyed independently from `control-workbench` and `interactive-figure`; a forwarding facade or unchanged central implementation does not satisfy this task.
- [ ] 3.2 Migrate its callers and tests, then remove the pilot direct import and authoritative business-switch branch from `content-renderers.tsx`, deleting only imports made unused by this migration.
- [ ] 3.3 Adapt generated slides through the same typed registry while preserving publication revision, manifest hash, role projection, and evidence lineage.
- [ ] 3.4 Prove that the manifest plugin registry, Prisma `TeachingResource` registry, and lesson-engine resource renderer paths remain separate public capabilities.

## 4. Migration and deletion ledger

- [ ] 4.1 Record every plugin migration entry with owner, old path, replacement, consumer count, contract/schema version, evidence path, and deletion condition.
- [ ] 4.2 Record the pilot central-import removal and zero-consumer receipt; do not retain a dead branch or widen the center switch for unrelated kinds.
- [ ] 4.3 Stage further plugin migrations only after each owner, schema, role/evidence contract, missing-renderer behavior, and deletion condition is explicit.

## 5. Targeted, domain, and browser verification

- [ ] 5.1 Add taxonomy, exact-key registry-composition, duplicate-full-key/different-capability, unknown-kind/reference, role-projection, missing-renderer, and evidence-lineage tests.
- [ ] 5.2 Add teacher/student browser coverage for `static-surface-3d`, distinct `compute.panel` capabilities, required missing renderer, and optional media/knowledge-card degradation; prove the center neither parses capabilities nor adds a branch.
- [ ] 5.3 Run the affected Interactive domain suites, typecheck, lint, strict OpenSpec validation, and `git diff --check`.
