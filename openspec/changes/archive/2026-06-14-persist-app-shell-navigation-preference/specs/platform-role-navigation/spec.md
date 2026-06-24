## ADDED Requirements

### Requirement: Route navigation inventory supports collapsed default shell state
Platform route inventory SHALL remain complete and usable when the desktop AppShell navigation defaults to collapsed.

#### Scenario: Collapsed navigation renders role-scoped entries
- **WHEN** a student, teacher, or administrator opens a route with collapsed desktop AppShell navigation
- **THEN** only routes allowed for that role SHALL appear
- **AND** each visible entry SHALL expose an icon, accessible name, route target, and active-state metadata.

#### Scenario: Route frame declares navigation behavior
- **WHEN** a primary route declares AppShell route metadata
- **THEN** its route inventory entry SHALL identify whether desktop navigation is collapsible
- **AND** routes that cannot support collapsed desktop navigation SHALL declare a temporary exception with owner and removal condition.
