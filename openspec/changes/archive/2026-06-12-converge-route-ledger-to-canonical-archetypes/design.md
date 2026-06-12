## Context

The current route inventory already acts as the platform navigation manifest. The implementation path should refactor that source rather than introduce `src/navigation/route-manifest.ts` as a competing truth source.

## Goals / Non-Goals

**Goals:**

- Make canonical archetype names the runtime vocabulary for route inventory.
- Preserve temporary alias metadata for existing frame names with removal conditions.
- Register migration-critical covered routes such as `/arena/challenges/[taskId]` in the central ledger.
- Assign migration ownership and visual QA expectations to primary routes.
- Provide a local governance check for ledger completeness and duplicate ownership.

**Non-Goals:**

- Migrating any page to the new shell.
- Changing route paths, auth callback behavior, or role redirects.
- Implementing the visual shell itself.

## Decisions

### Decision 1: Existing route inventory remains the source of truth

`PLATFORM_PRIMARY_ROUTE_INVENTORY` remains the canonical ledger unless the implementation explicitly splits the module into smaller files that re-export the same public contract.

### Decision 2: Aliases are temporary, not parallel archetypes

Legacy frames such as `learning-map`, `immersive-task-workspace`, `learner-data`, `teacher-operations`, `admin-governance`, and `knowledge-graph` should be represented as aliases of canonical archetypes. Every alias requires owner and retirement metadata.

### Decision 3: Ledger ownership prevents migration ambiguity

Each primary route must name the owning change for migration or a temporary exception. The existing `owningChange` field should remain the general route ownership field unless implementation chooses to add a narrower `unifiedUiMigrationOwner`; either way, historical ownership must not be silently overwritten. A route cannot be simultaneously owned by learner, mission, and operations migrations without an explicit dependency or coupling note.

### Decision 4: Auth entry is a public-entry alias during convergence

`auth-entry` should not become a seventh archetype. Login and auth callback routes should resolve to `public-entry` while preserving auth-specific metadata such as callback intent, auth panel behavior, hidden dock rules, and unauthenticated state.

### Decision 5: Challenge detail is part of the central ledger

Arena challenge detail is a real App Router route and part of the mission migration acceptance path. The ledger must register `/arena/challenges/[taskId]` as a primary route or covered route with route pattern, route file, `mission-workspace` archetype, owner, return-target behavior, and visual QA profile.

## Validation

- Ledger tests verify all primary routes resolve to canonical archetypes.
- Governance tests verify alias retirement metadata and migration ownership.
- Route tests verify `/arena/challenges/[taskId]` resolves through the central ledger as `mission-workspace`.
- Auth tests verify `/login?callbackUrl=...` preserves callback intent while resolving through `public-entry`.
- Route coverage tests verify homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, knowledge/data, teacher, admin, and report surfaces remain inventoried.
- `rtk openspec validate converge-route-ledger-to-canonical-archetypes --strict` passes.
