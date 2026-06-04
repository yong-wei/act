## Purpose
Give administrators a UI-level view of data governance health that matches the evidence reports used by the platform.
## Requirements
### Requirement: Admin dashboard exposes governance report surfaces
The admin data governance dashboard SHALL expose source coverage, session quality, feature cache health, and pipeline health.

#### Scenario: Admin sees session quality distribution
- **WHEN** an administrator opens data governance dashboard
- **THEN** the dashboard shows recent green, yellow, and red session counts using the central session quality status

### Requirement: Admin source coverage explains exclusions
The admin dashboard SHALL show provenance and exclusion reasons for evidence sources.

#### Scenario: Excluded source is explainable
- **WHEN** a source family is seed, demo, showcase, test, unsupported, or context-only
- **THEN** the dashboard reports the exclusion reason and row counts when available

### Requirement: Admin governance uses operations density
Admin governance and usage dashboards SHALL use scan-friendly operations density for metrics, tables, queues, filters, and risk lists.

#### Scenario: Admin reviews governance data
- **WHEN** an admin opens data governance, usage statistics, user management, or system configuration
- **THEN** numeric values SHALL align consistently
- **AND** status, risk, freshness, and source-quality labels SHALL use shared operations semantics instead of page-local badge vocabularies.

### Requirement: Admin configuration separates domains and actions
Admin configuration surfaces SHALL separate user, model, system, notification, ethics, and governance domains through shared console navigation.

#### Scenario: Admin opens system configuration
- **WHEN** `/admin/config` or a future model management route renders
- **THEN** the page SHALL expose domain navigation, save/reset actions, status context, and validation feedback in consistent locations
- **AND** form groups SHALL not compete visually with global navigation or floating dock controls.
