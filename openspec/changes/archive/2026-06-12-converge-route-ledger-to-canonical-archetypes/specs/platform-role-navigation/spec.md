## ADDED Requirements

### Requirement: Route ledger uses canonical archetypes at runtime
The central route inventory SHALL use canonical experience archetypes as the runtime vocabulary for primary route shell and navigation decisions.

#### Scenario: Primary route metadata is resolved
- **WHEN** homepage, login, dashboard, Interactive Learning, Arena, Control Workbench, adaptive practice, knowledge/data, learner record, teacher, admin, or report routes are resolved from the inventory
- **THEN** each route SHALL declare one of `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** legacy frame names SHALL be exposed only as temporary alias metadata with an owning change and retirement condition.

#### Scenario: Arena challenge detail is registered
- **WHEN** `/arena/challenges/[taskId]` is used as part of the unified mission migration path
- **THEN** the central route ledger SHALL register it as a primary route or covered route with route pattern, route file, `mission-workspace` archetype, owning change, Arena return-target behavior, visual QA profile, and legacy shell disposition
- **AND** mission migrations SHALL NOT define separate page-local shell metadata for this route outside the central ledger.

#### Scenario: Auth entry converges
- **WHEN** login or auth callback routes currently use `auth-entry` frame metadata
- **THEN** the route ledger SHALL resolve them through `public-entry` while preserving callback intent, auth panel behavior, unauthenticated state, and hidden dock rules
- **AND** `auth-entry` SHALL NOT become a seventh canonical archetype.

#### Scenario: Route ownership is reviewed
- **WHEN** the unified UI migration series is planned or executed
- **THEN** every primary route SHALL name exactly one owning migration change or a temporary exception
- **AND** existing `owningChange` values SHALL be preserved or explicitly migrated rather than silently overwritten
- **AND** duplicate ownership SHALL fail route ledger validation unless an explicit dependency or coupling rule is recorded.

### Requirement: Route ledger preserves navigation semantics during convergence
Canonical archetype migration SHALL preserve existing route access, role routing, callback intent, and contextual return behavior.

#### Scenario: Existing navigation paths are exercised
- **WHEN** a user opens login callbacks, profile/account actions, role cockpit actions, Arena-to-workbench returns, or learning entry routes during ledger convergence
- **THEN** the resolved route metadata SHALL preserve the existing destination intent
- **AND** no page SHALL require page-local navigation lists to override the central route ledger.
