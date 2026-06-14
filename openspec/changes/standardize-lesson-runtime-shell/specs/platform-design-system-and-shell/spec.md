## ADDED Requirements

### Requirement: Lesson runtime routes preserve platform shell continuity
Interactive lesson runtime routes SHALL preserve AppShell continuity while expressing runtime-specific local controls.

#### Scenario: Runtime route renders
- **WHEN** a lesson runtime route renders
- **THEN** AppShell SHALL provide route breadcrumbs, theme switching, user center, and shared Konling dock
- **AND** local runtime controls SHALL NOT duplicate global navigation, replace the user center, or embed a second assistant panel.

#### Scenario: Invalid session renders
- **WHEN** a runtime session is invalid, missing, or unavailable
- **THEN** the route SHALL show an explicit blocking or recovery state with a clear return path
- **AND** it SHALL NOT show stale full classroom content alongside an ambiguous `Not found` message.
