## Why

Assessment and Personalization now have canonical public boundaries, but the top-level `src/features/adaptive` surface and 19 production `src/lib/adaptive-*`/`adaptive-planning/*` files still act as business entrypoints for routes, journey UI, path helpers, and evidence flows. The existing retirement contract supplies deletion gates, yet the current HEAD still needs a concrete owner mapping and consumer migration before those paths can be removed.

## What Changes

- Remove `adaptive` as a business owner: map assessment semantics to Assessment, learner state/path/recommendation/intervention semantics to Personalization, and leave only explicitly ownerless UI composition at the route/experience boundary.
- Migrate every production consumer of the 19 `src/lib/adaptive-*`/`adaptive-planning/*` files and the 10 production `src/features/adaptive` files to canonical Assessment or Personalization APIs, ports, plugins, or experience modules.
- Delete unconsumed bridges, re-exports, aliases, duplicate state/normalization helpers, and obsolete adaptive flags after exact current-head zero-production-import evidence. Preserve historical tests only when they document a live contract.
- Keep learner evidence, Assessment attempts/catalog snapshots, path history, outbox delivery, old tables, and rollback data intact; retirement is source ownership cleanup, not data deletion.
- Do not add a new adaptive facade, second planner, second learner-state reducer, production behavior change, deployment, or selector activation.

## Capabilities

### New Capabilities

- `adaptive-business-ownership-retirement`: Canonical ownership, consumer migration, and deletion gates for the remaining adaptive feature and `src/lib` entrypoints.

### Modified Capabilities

- None. `adaptive-entrypoint-retirement`, Assessment, Personalization, Learning Record, and path contracts remain authoritative; this change supplies the concrete current-head retirement tranche.

## Impact

- Affects `src/features/adaptive/`, the current 19-file `src/lib/adaptive-*`/`src/lib/adaptive-planning/` production surface, adaptive route/UI consumers, path execution/advisor helpers, profile/knowledge/simulation composition, tests, and architecture/deprecation evidence.
- Requires C0 and C1 evidence, current import/call/dynamic-load scans, characterization tests, public export comparison, and architecture fitness.
- Does not delete persistent data, change Assessment/Personalization algorithms, modify Prisma schema, publish runtime assets, deploy, or change production authority.
