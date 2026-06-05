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

### Requirement: Incompatible legacy shells may be replaced
The platform SHALL allow legacy shell components to be removed when adapting them would preserve incompatible hierarchy or page-local navigation.

#### Scenario: Legacy shell conflicts with archetype rules
- **WHEN** `FeaturePageNav`, `UnifiedTopBar`, `ArenaPageShell`, teacher/admin headers, premium lesson shells, or page-local fixed controls conflict with the target archetype
- **THEN** the migration SHALL replace or retire the legacy shell rather than visually restyling it in place
- **AND** route behavior, auth callback behavior, contextual return targets, and role actions SHALL remain intact.
