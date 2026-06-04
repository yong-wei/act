## ADDED Requirements

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
