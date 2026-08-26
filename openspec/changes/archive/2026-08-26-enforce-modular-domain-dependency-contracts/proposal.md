## Why

The charter can assign ownership, but without executable dependency contracts new code can continue to invert the architecture. The baseline identifies two production `src/features` to `@/app` imports in the teacher diagnosis surface (with separate test imports), while `src/lib` remains a broad business dependency zone; the repository needs a monotonic fitness gate that stops new violations without pretending that one change can migrate all legacy code.

## What Changes

- Define domain `public-api`, application use-case, ports, and adapters as the only new cross-domain entry surfaces.
- Forbid production `feature -> app` imports, cross-domain deep imports, and direct Prisma/Next/React dependencies in domain core code.
- Freeze new business files under `src/lib`; existing files remain explicit migration inputs rather than being renamed wholesale.
- Establish a denominator-closed, production/test/generated/compatibility-aware temporary allowlist whose size and edge set can only decrease.
- Add architecture fitness checks for import direction, public-boundary usage, dependency strongly connected components, and allowlist deletion conditions.
- Reuse the formal source-boundary, module-hygiene, route-safety, rendering-boundary, and stable-dependency capabilities; do not create parallel versions of those contracts.
- Keep this change scoped to rules and enforcement: it does not migrate every old module, change product behavior, claim work, deploy, or activate production.

## Capabilities

### New Capabilities

- `modular-domain-dependency-contracts`: Defines enforceable public-boundary, layer, dependency-graph, allowlist, and architecture-fitness rules for the modular monolith.

### Modified Capabilities

None. `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` are reused as existing contracts and are not restated or weakened here.

## Impact

- Adds architecture-rule configuration, fitness tests, dependency/SCC reports, and a bounded exception ledger in the implementation phase.
- Consumes the qualified charter and its predecessor baseline; its denominators distinguish production from tests and framework convention files.
- Establishes the enforcement contract used by later vertical slices, beginning with teacher diagnosis.
- Does not claim completion of legacy migration, remove unrelated modules, alter authentication or route semantics, deploy, or activate production.
