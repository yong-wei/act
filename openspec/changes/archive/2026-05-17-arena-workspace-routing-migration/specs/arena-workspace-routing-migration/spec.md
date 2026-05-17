## ADDED Requirements

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
