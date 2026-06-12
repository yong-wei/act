## ADDED Requirements

### Requirement: Student secondary routes share canonical journey navigation
Student secondary learning, practice, challenge, experiment, and learner-record routes SHALL share a canonical route-family navigation model derived from central route inventory and student learning intent groups.

#### Scenario: Student opens a secondary page
- **WHEN** a student opens Interactive Learning, course catalog, chapter components, cross-domain exploration, adaptive practice, Arena, Control Workbench, knowledge graph, profile, growth, or evidence routes
- **THEN** visible navigation SHALL identify the current route family and adjacent learn, practice, challenge, experiment, and learner-record destinations according to central metadata
- **AND** the route SHALL NOT replace the canonical journey navigation with page-local topbars, unrelated two-item sidebars, or implementation-module directories.

#### Scenario: A route has a local tool panel
- **WHEN** a page needs course filters, graph filters, practice controls, or workspace tools
- **THEN** those controls SHALL render as local tools within the page or AppShell workspace zones
- **AND** they SHALL NOT act as platform navigation.

#### Scenario: Interactive Learning first-hop destination renders
- **WHEN** a student follows an Interactive Learning entry action to chapter components or cross-domain exploration
- **THEN** the destination SHALL retain the same learning-atlas shell family and route trace
- **AND** it SHALL NOT fall back to the legacy `UnifiedTopBar` navigation language unless a route-ledger exception names the owner and removal condition.
