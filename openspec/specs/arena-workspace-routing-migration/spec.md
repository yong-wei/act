# arena-workspace-routing-migration Specification

## Purpose
TBD - created by archiving change arena-workspace-routing-migration. Update Purpose after archive.
## Requirements
### Requirement: Implemented workspace modes route to unified workbench
Arena workspace links SHALL route implemented workspace modes to `/interactive-learning/control-workbench` with an explicit preset.

#### Scenario: Classic white-box task routes to unified workbench
- **WHEN** `getArenaWorkspaceHref` is called for a `multi-representation-linkage` task after the classic preset is implemented
- **THEN** the returned URL SHALL point to `/interactive-learning/control-workbench`
- **AND** it SHALL include `arenaTask` and `preset=multi-representation-linkage`.

#### Scenario: Composite task routes to unified workbench
- **WHEN** `getArenaWorkspaceHref` is called for a `block-diagram-workbench` task after the composite preset is implemented
- **THEN** the returned URL SHALL point to `/interactive-learning/control-workbench`
- **AND** it SHALL include `preset=block-diagram-workbench`.

### Requirement: Route parameters are preserved
Arena workspace routing SHALL preserve assignment and publication parameters.

#### Scenario: Publication id is passed through
- **WHEN** `getArenaWorkspaceHref` receives `publicationId`
- **THEN** the returned URL SHALL include the same `publicationId` value.

### Requirement: Odyssey remains dedicated until bridge is ready
Control Odyssey tasks SHALL remain on the dedicated Odyssey route until the Odyssey bridge change is implemented.

#### Scenario: Odyssey task routes before bridge
- **WHEN** `getArenaWorkspaceHref` is called for a `control-odyssey` task before bridge migration
- **THEN** the returned URL SHALL remain `/interactive-learning/control-odyssey?arenaTask=<taskId>`.

### Requirement: Challenge detail names unified workbench entry
Challenge detail pages SHALL refer students to the unified control workbench for design, simulation, and official submission after routing migration.

#### Scenario: Detail page workbench link
- **WHEN** a student opens a migrated challenge detail page
- **THEN** the primary entry link SHALL be labeled in Chinese as entering the control workbench
- **AND** the detail page SHALL still not expose controller submission forms.

### Requirement: Odyssey workspace routes carry assigned level identity
Arena workspace routing SHALL include the configured Odyssey level identity for a Control Odyssey task.

#### Scenario: Dedicated Odyssey route includes assigned level
- **WHEN** `getArenaWorkspaceHref` routes a configured Control Odyssey task
- **THEN** the returned Odyssey URL MUST include `arenaTask` and the configured `odysseyLevelId`
- **AND** it MUST preserve valid publication and adaptive-path context.

