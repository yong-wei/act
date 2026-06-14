## ADDED Requirements

### Requirement: Concrete interactive course entries remain in AppShell
Concrete interactive course entry routes SHALL preserve platform shell, breadcrumb, theme, user center, and shared assistant continuity.

#### Scenario: Course entry route renders
- **WHEN** a concrete interactive course entry route renders
- **THEN** AppShell SHALL provide global navigation, breadcrumb, theme switching, user center, and shared Konling dock
- **AND** the entry route SHALL NOT introduce competing global navigation or a page-local topbar that replaces the platform shell.
