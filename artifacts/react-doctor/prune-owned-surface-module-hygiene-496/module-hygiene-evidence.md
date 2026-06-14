# Module Hygiene Evidence

Change: `prune-owned-surface-module-hygiene`
Issue: #496

## React Doctor Warning Delta

Source files:

- `baseline-owned-warnings.json`
- `after-owned-warnings.json`

| Metric | Baseline | After | Delta |
| --- | ---: | ---: | ---: |
| Selected warnings | 2633 | 2626 | -7 |
| `no-barrel-import` | 7 | 0 | -7 |
| `only-export-components` | 79 | 78 | -1 |
| `unused-file` | 66 | 67 | +1 |
| `unused-export` | 384 | 384 | 0 |
| `prefer-dynamic-import` | 7 | 7 | 0 |
| `circular-dependency` | 3 | 3 | 0 |
| `unused-dependency` | 2 | 2 | 0 |

The `unused-file` increase is expected after replacing simulation barrel imports with direct imports. `src/resources/simulations/components/index.ts` is now easier for the static warning pass to classify as unused, but it remains a protected public barrel for simulation components and should not be deleted in this scoped change.

## Implemented Cleanup

- Deleted `src/app/page-simple-working.tsx` after checking that it is not an App Router convention file and has no source references.
- Moved `canAccessDrilldown` from `src/features/data-center/shared/drilldown-link.tsx` into `src/features/data-center/shared/drilldown-access.ts`, leaving the component file with component exports only.
- Replaced simulation scene imports from `../components` and `../environment` barrels with direct component and environment module imports.
- Kept `src/components/shared/page-floating-controls.tsx`, route files, simulation public barrels, registry entrypoints, generated-style entrypoints, runtime side-effect entrypoints, test helpers, and public API surfaces protected unless a later change supplies stronger graph and contract evidence.

## Graph And Reference Evidence

- `codegraph status` reported the index ready for the repository during the cleanup pass.
- `codegraph_search canAccessDrilldown` found exactly the helper in `src/features/data-center/shared/drilldown-access.ts`, plus imports from `drilldown-link.tsx` and `data-center-contracts.test.ts`.
- `codegraph context` found no meaningful usage context for `src/app/page-simple-working.tsx`.
- `rg page-simple-working src` found no source references to the deleted file.
- `rg "from '../components'|from \"../components\"|from '../environment'|from \"../environment\"" src/resources/simulations/simulations` found no remaining simulation scene barrel imports after the cleanup.
- `rg canAccessDrilldown src` shows the helper now lives in `drilldown-access.ts`, is consumed by `drilldown-link.tsx`, and is tested through `data-center-contracts.test.ts`.

## Validation Evidence

- `rtk npx tsc --noEmit --pretty false` passed after tightening intentionally malformed commercial UI governance fixtures with explicit casts.
- `rtk npx vitest run src/features/data-center/__tests__/data-center-contracts.test.ts src/lib/__tests__/commercial-ui-governance.test.ts src/lib/__tests__/platform-ui-contracts.test.ts` passed.
- `rtk npm run test:react-doctor:owned-errors` passed with zero selected diagnostics after changing AppShell navigation preference to an SSR-safe collapsed first render plus a mount-only persisted preference sync.
- `rtk npm run test:react-doctor:owned-security` passed with zero selected diagnostics.

Additional final gates are recorded in `openspec/changes/archive/2026-06-14-prune-owned-surface-module-hygiene/tasks.md`.
