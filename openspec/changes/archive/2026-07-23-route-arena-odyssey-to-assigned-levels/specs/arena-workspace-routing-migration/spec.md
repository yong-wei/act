## ADDED Requirements

### Requirement: Odyssey workspace routes carry assigned level identity
Arena workspace routing SHALL include the configured Odyssey level identity for a Control Odyssey task.

#### Scenario: Dedicated Odyssey route includes assigned level
- **WHEN** `getArenaWorkspaceHref` routes a configured Control Odyssey task
- **THEN** the returned Odyssey URL MUST include `arenaTask` and the configured `odysseyLevelId`
- **AND** it MUST preserve valid publication and adaptive-path context.
