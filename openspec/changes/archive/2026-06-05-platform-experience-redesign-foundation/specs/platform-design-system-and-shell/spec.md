## ADDED Requirements

### Requirement: Primary routes declare a registered experience archetype
The platform SHALL classify every primary UI route under a registered experience archetype before migration is accepted.

#### Scenario: Route shell is changed
- **WHEN** a primary route changes header, shell, layout, navigation, floating controls, first viewport, or theme treatment
- **THEN** the route SHALL declare one of `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** the implementation SHALL follow that archetype's navigation layers, information density, mobile behavior, and theme template rules.

### Requirement: Canonical archetype names are the implementation vocabulary
The platform SHALL use the redesigned archetype names as the canonical vocabulary for route inventory, visual QA manifests, governance rules, and migration ledgers.

#### Scenario: Existing route-frame names remain in code
- **WHEN** legacy names such as `learning-map`, `immersive-task-workspace`, `learner-data`, `teacher-operations`, `admin-governance`, or `knowledge-graph` remain during migration
- **THEN** they SHALL be registered as temporary aliases of `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **AND** the ledger SHALL name the owning change and retirement condition for every alias.

### Requirement: Route families are registered under archetypes
The platform SHALL register primary route families under the canonical archetypes before page-family migrations are accepted.

#### Scenario: Route family inventory is reviewed
- **WHEN** the platform redesign inventory is reviewed
- **THEN** `public-entry` SHALL govern homepage, login, and public learning entry routes
- **AND** `learning-atlas` SHALL govern Interactive Learning, course catalog, adaptive entry, and student path overview routes
- **AND** `mission-workspace` SHALL govern Control Workbench, Arena task detail, simulations, and interactive runtime routes
- **AND** `knowledge-data-map` SHALL govern knowledge graph, data center, evidence browser, and learner record routes
- **AND** `operations-console` SHALL govern teacher and administrator workflow routes
- **AND** `report-ledger` SHALL govern teacher reports, governance snapshots, and exported review surfaces.

### Requirement: Incompatible legacy shells may be replaced
The platform SHALL allow legacy shell components to be removed when adapting them would preserve incompatible hierarchy or page-local navigation.

#### Scenario: Legacy shell conflicts with archetype rules
- **WHEN** `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher/admin headers, premium lesson shells, or page-local fixed controls conflict with the target archetype
- **THEN** the migration SHALL replace or retire the legacy shell rather than visually restyling it in place
- **AND** route behavior, auth callback behavior, contextual return targets, and role actions SHALL remain intact.

### Requirement: Route archetypes own shell conformance rules
The platform SHALL define shell conformance rules for every registered route archetype.

#### Scenario: A primary route adopts an archetype
- **WHEN** a route declares `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger`
- **THEN** the route shell SHALL match that archetype's first-viewport purpose, navigation-layer emphasis, panel density, local tool placement, mobile collapse behavior, and light/dark template behavior
- **AND** the route SHALL NOT use a generic card-page shell when the archetype calls for an entry surface, atlas, workspace, data map, console, or ledger structure.

#### Scenario: Archetype shell expectations are reviewed
- **WHEN** shell conformance is reviewed for a migrated route
- **THEN** `public-entry` SHALL prioritize orientation and role entry, `learning-atlas` SHALL prioritize path discovery, `mission-workspace` SHALL prioritize task execution and local tools, `knowledge-data-map` SHALL prioritize graph/data relationships, `operations-console` SHALL prioritize repeated operator workflows, and `report-ledger` SHALL prioritize evidence, status, and export readiness.
