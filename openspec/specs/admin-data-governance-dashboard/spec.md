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
- **AND** administrator audit and governance views SHALL preserve demo-source provenance even when the visible demo-data marker is disabled in ordinary data-center UI.

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
- **AND** administrators SHALL be able to enable or disable visible demo-data source labels for data-center UI.

### Requirement: Demo data labels are administrator-controlled display policy
The system SHALL default visible demo-data source labels to disabled in ordinary data-center UI while preserving source truth.

#### Scenario: Demo label display is disabled
- **WHEN** the administrator setting for demo-data source labels is disabled or unset
- **THEN** ordinary data-center source markers SHALL NOT display a visible "demo data" tag.
- **AND** source family, provenance, exclusion reason, and governance audit data SHALL remain available to authorized teacher or administrator workflows.
- **AND** DOM or browser evidence SHALL cover the ordinary data-center UI in this disabled state.

#### Scenario: Demo label display is enabled
- **WHEN** an administrator enables demo-data source labels
- **THEN** data-center UI SHALL display the demo-data marker for demo sources using shared source-quality semantics.
- **AND** the setting SHALL affect presentation only, not evidence scoring or source classification.
- **AND** DOM or browser evidence SHALL cover the ordinary data-center UI in this enabled state.

### Requirement: Admin governance surfaces use action-oriented risk hierarchy
The admin data governance dashboard SHALL present governance risks, pending checks, source freshness, and repair actions through an action-oriented hierarchy.

#### Scenario: Admin governance renders
- **WHEN** `/admin/data-governance` or related governance dashboard surfaces render
- **THEN** critical risks, stale sources, pending jobs, and repair actions SHALL be visually prioritized
- **AND** metrics SHALL not appear as disconnected decorative cards without action context.

### Requirement: Admin governance connects configuration, source quality, repair, and redacted output
The admin governance UI SHALL connect system/user changes to governance status, repair actions, and privacy-safe outputs.

#### Scenario: Governance state requires attention
- **WHEN** user import, role permission, system configuration, source coverage, session data quality, or privacy scope affects governance status
- **THEN** the UI SHALL show affected object, freshness or quality state, repair or review action, restricted-state explanation, and redacted report/export availability where applicable
- **AND** governance status SHALL NOT be presented as decorative metrics without an actionable path.
