## MODIFIED Requirements

### Requirement: Admin source coverage explains exclusions
The admin dashboard SHALL show provenance and exclusion reasons for evidence sources.

#### Scenario: Excluded source is explainable
- **WHEN** a source family is seed, demo, showcase, test, unsupported, or context-only
- **THEN** the dashboard reports the exclusion reason and row counts when available.
- **AND** administrator audit and governance views SHALL preserve demo-source provenance even when the visible demo-data marker is disabled in ordinary data-center UI.

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
