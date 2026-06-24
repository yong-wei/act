## ADDED Requirements

### Requirement: AppShell uses compact page edge spacing
The platform shell SHALL render registered route frames with compact fixed viewport edges instead of centering primary content inside dynamic wide-screen maximum-width containers.

#### Scenario: Wide desktop route frame renders
- **WHEN** a registered route frame renders at 1440px, 1920px, or 2560px width
- **THEN** the primary AppShell content edge SHALL remain governed by the navigation rail and compact spacing token
- **AND** the content frame SHALL NOT gain additional side gutters from `mx-auto max-w-*`, `container mx-auto`, or equivalent viewport-centered page wrappers.

#### Scenario: Text or form route renders
- **WHEN** a text, form, dashboard, report, learning, or operations page renders inside AppShell
- **THEN** the page-level frame SHALL still use compact edge spacing
- **AND** any narrower reading, form, modal, or preview measure SHALL be an internal component constraint rather than the outer page boundary.

#### Scenario: Compact spacing exception is retained
- **WHEN** a route or component keeps a page-level maximum width after the compact spacing migration
- **THEN** the exception SHALL be registered with the owning change, affected route or component, reason, and removal or permanence condition
- **AND** unregistered page-level centered wrappers SHALL fail governance.

#### Scenario: Page-level wrapper inventory is reviewed
- **WHEN** the compact spacing migration is accepted
- **THEN** every route-level or shell-level centered width wrapper SHALL be either migrated to compact edge spacing or recorded in the compact spacing exception inventory
- **AND** unclassified route files, shared shells, interactive runtime wrappers, legacy shells, text pages, form pages, and report pages SHALL block acceptance.

### Requirement: Route archetypes inherit sitewide compact spacing
The platform route archetypes SHALL share the compact spacing model unless an archetype-specific implementation narrows only an internal component.

#### Scenario: Route archetype content frame is reviewed
- **WHEN** `public-entry`, `learning-atlas`, `mission-workspace`, `knowledge-data-map`, `operations-console`, or `report-ledger` content frame classes are reviewed
- **THEN** each archetype SHALL use the shared compact edge model for its primary content area
- **AND** archetype-specific classes SHALL NOT reintroduce centered page caps as their default behavior.

#### Scenario: Navigation rail changes width
- **WHEN** desktop navigation switches between expanded, collapsed, or hidden states
- **THEN** the content edge MAY move by the navigation rail width
- **AND** it SHALL NOT move because the content frame is centered inside a maximum-width container.
