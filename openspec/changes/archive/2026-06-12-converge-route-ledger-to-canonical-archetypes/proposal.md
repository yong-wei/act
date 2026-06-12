## Why

The unified UI plan should not create a second navigation registry. The project already has a primary route inventory in `src/lib/platform-role-navigation.ts`, but the inventory still carries legacy frame names while the current commercial UI specifications require canonical archetypes such as `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, and `report-ledger`.

Without a first change that converges this ledger, later AppShell and page migrations will keep translating route semantics by hand. That would recreate page-local navigation drift under a new name.

## What Changes

- Convert the existing route inventory to canonical archetype vocabulary while preserving temporary alias metadata for legacy frame names.
- Add missing primary or covered-route records required by the migration path, including `/arena/challenges/[taskId]`.
- Add ownership metadata for the unified UI migration series so every primary route has one responsible migration change or a narrow temporary exception.
- Record route-derived navigation layers, return targets, dock behavior, theme support, visual QA profile, and legacy shell disposition in the same ledger.
- Add local checks that fail when primary route metadata is missing, duplicated, or still uses an unowned legacy frame.

## Capabilities

### Modified Capabilities

- `platform-role-navigation`
- `platform-design-system-and-shell`

## Impact

- Hard prerequisite for `upgrade-platform-app-shell-to-archetype-shell`.
- Does not migrate page components or redesign visuals.
- Treats `three-style-learning-path-loop`, `runtime-enhancement-pack-overlay`, `assistant-closeloop-demo-effect-report`, and React Doctor cleanup changes as future baseline capabilities.
