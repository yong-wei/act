## ADDED Requirements

### Requirement: Platform shell owns the floating action dock
The platform shell SHALL provide a shared floating action dock for Konling, management, and settings controls.

#### Scenario: A primary route renders floating controls
- **WHEN** a public, student, teacher, admin, immersive workspace, or knowledge graph route exposes Konling or management/settings controls
- **THEN** the controls SHALL render through the shared dock with consistent bottom/right offsets, spacing, hit target size, z-index, theme treatment, and responsive collapse behavior
- **AND** page-local fixed buttons SHALL NOT compete with or overlap the shared dock.

#### Scenario: Dock controls are not available
- **WHEN** Konling, management, or settings controls are hidden by role, feature flag, or workspace mode
- **THEN** the dock SHALL preserve layout rules without leaving orphan spacing or unreachable focus targets.

### Requirement: Platform shell supports premium route frames
The platform shell SHALL support route frames for public entry, learning map, immersive task workspace, learner data, teacher operations, admin governance, and knowledge graph contexts.

#### Scenario: A primary route is migrated
- **WHEN** a primary route adopts the premium shell
- **THEN** it SHALL declare its route frame type, role scope, contextual navigation, account action semantics, and floating dock behavior through shared shell contracts
- **AND** it SHALL avoid duplicating the global page frame inside feature components.
