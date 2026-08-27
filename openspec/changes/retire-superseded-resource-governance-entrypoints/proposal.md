## Why

The first three changes provide a generated resource identity/index, an independent eligibility read contract, and a version-bound knowledge-surface response. Once a concrete caller has migrated, its old identity, aggregate readiness, registry-read, or knowledge-resource projection entrypoint becomes misleading and keeps the architecture's compatibility surface growing. Deleting such an entry too early is equally dangerous: hidden routes, scripts, tests, dynamic imports, or rollback readers may still depend on it.

Retirement must therefore be an evidence-gated deletion operation. It is allowed only for entries actually replaced by R1/R2/R3, with a complete consumer denominator, revision-bound migration, zero callers, and a tested rollback archive. Historical and Legacy display, immutable release/projection readers, and existing presentation contracts remain protected.

## What Changes

- Define an immutable `ResourceGovernanceRetirementManifest` and validator for retiring superseded identity, eligibility, registry-read, and knowledge-resource projection entrypoints.
- Require a complete production/test/generated/compatibility/framework and route/API/model/script/test/caller denominator, an exact replacement identity, revision-bound migration evidence, zero-caller evidence, and rollback evidence before deletion.
- Delete only the old entrypoints proven to be replaced by R1/R2/R3; record each deletion and its evidence in the deprecation ledger.
- Retain Legacy display, historical snapshots/crosswalks/audits/rollback artifacts, immutable Runtime and Teaching Projection readers, and the #1498/#1503/#1509/#1515/#1543 contracts.
- Enforce that architecture allowlists and deprecation-ledger entries only decrease; a permanent facade or renamed wrapper does not count as retirement.

## Capabilities

### New Capabilities

- `superseded-resource-governance-retirement`: Defines evidence-gated deletion, protected historical/runtime surfaces, rollback, and monotonic ledger behavior.

### Modified Capabilities

None. The change consumes `resource-identity-and-generated-registry-index`, `resource-eligibility-and-release-activation`, `versioned-knowledge-surface-read-contracts`, and existing `legacy-knowledge-runtime-retirement` contracts without replacing their owners.

## Impact

- **Owners and denominator:** Inventory every candidate old identity, aggregate eligibility/readiness, registry-read, and knowledge-resource projection entrypoint and all direct, reverse, dynamic, framework, generated, compatibility, route/API, Prisma/model, script, test, and browser callers. Include the R1/R2/R3 replacement APIs, `src/lib/resource-registry*`, ResourceNode/readiness/audit readers, `src/lib/authoritative-knowledge/**`, `src/lib/authority-domain-shards/**`, `src/app/api/knowledge/**`, teacher/resource routes, knowledge scripts, caches, and rollback readers. The retirement manifest must publish this closed denominator and its classification rather than relying on a successful-output scan.
- **Public target:** A server-side `verifyResourceGovernanceRetirement(manifest, currentGraph)` gate returns an evidence-bound disposition; a separate deletion command may remove only the listed, proven entrypoints. The gate is not an activation or release writer.
- **Trust boundary:** Denominator, replacement identity/revision, zero-caller, protected-surface, and rollback checks are hard gates. Deprecation/allowlist ledger reduction is a contract gate. Historical/Legacy retention and temporary migration diagnostics are retained behavior, not deletion failures.
- **Dependencies:** Requires completed and verified R2 and R3 migrations, and consumes R1's generated index. It coordinates with `legacy-knowledge-runtime-retirement`; it does not depend on the tracking parent or own Runtime Release/Teaching Projection activation.
- **Non-goals:** No bulk resource rebind, Prisma migration, production selector/cutover/deploy, deletion of Legacy or history, deletion of immutable runtime/projection readers, removal of #1498/#1503/#1509/#1515/#1543, or permanent compatibility facade.
