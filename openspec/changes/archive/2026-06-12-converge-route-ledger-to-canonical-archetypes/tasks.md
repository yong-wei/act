## 1. Ledger Model

- [x] 1.1 Extend the existing route inventory contract with canonical archetype, legacy alias, owning change, theme support, dock behavior, visual QA profile, and legacy shell disposition fields.
- [x] 1.2 Map existing legacy frame names to canonical archetypes without changing public route paths.
- [x] 1.3 Add retirement metadata for every remaining alias and legacy shell reference.
- [x] 1.4 Treat `auth-entry` as a temporary alias or auth-state specialization of `public-entry`, not as a separate canonical archetype.
- [x] 1.5 Preserve existing route ownership fields or migrate them explicitly; do not silently overwrite historical `owningChange` values.

## 2. Inventory Coverage

- [x] 2.1 Assign canonical archetypes to homepage, login, dashboard, Interactive Learning, Arena, Arena challenge detail, Control Workbench, adaptive practice, knowledge/data, learner record, teacher, admin, and report surfaces.
- [x] 2.2 Assign exactly one owning migration change or temporary exception to every primary route.
- [x] 2.3 Preserve callback, role cockpit, profile/account, and contextual return semantics in route metadata.
- [x] 2.4 Register `/arena/challenges/[taskId]` with route pattern, route file, `mission-workspace` archetype, owner, Arena return-target behavior, and visual QA profile.

## 3. Governance

- [x] 3.1 Add or update local route-ledger tests for canonical archetype coverage.
- [x] 3.2 Add alias retirement and duplicate ownership checks.
- [x] 3.3 Ensure tests produce actionable failure messages naming the route and missing field.
- [x] 3.4 Add route-ledger tests for `/arena/challenges/[taskId]` and `/login?callbackUrl=...` convergence behavior.

## 4. Verification

- [x] 4.1 Run the relevant route/navigation ledger tests.
- [x] 4.2 Run `rtk openspec validate converge-route-ledger-to-canonical-archetypes --strict`.
