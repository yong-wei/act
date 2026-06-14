## ADDED Requirements

### Requirement: Commercial UI governance verifies AppShell navigation preference persistence
Commercial UI governance SHALL verify that collapsed desktop navigation is the default and that user preference persists across representative platform routes.

#### Scenario: Navigation preference evidence is captured
- **WHEN** visual or interaction evidence is produced for AppShell route-frame changes
- **THEN** the evidence SHALL include default collapsed desktop navigation, user-expanded desktop navigation, route-to-route preference persistence across representative student, teacher, and administrator routes, and mobile drawer behavior
- **AND** the evidence SHALL prove that collapsed navigation does not overlap local workspace tools or the shared floating dock.

#### Scenario: Preference regression is detected
- **WHEN** a route resets the desktop navigation state without user action, renders expanded by default without an approved exception, or leaks desktop rail geometry into mobile
- **THEN** governance SHALL fail or report the route as a blocking shell regression according to the active governance mode.
