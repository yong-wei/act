# arena-control-workbench-routing Specification

## Purpose
TBD - created by archiving change arena-control-workbench-routing-integration. Update Purpose after archive.
## Requirements
### Requirement: Arena routes supported tasks to the comprehensive control workbench
The Arena workspace routing helper SHALL route supported non-Odyssey Arena tasks to `/interactive-learning/control-workbench`.

#### Scenario: White-box task route
- **WHEN** `getArenaWorkspaceHref` is called for a white-box task such as `task-second-order-lead-pid`
- **THEN** the returned URL MUST target `/interactive-learning/control-workbench`
- **AND** it MUST include `arenaTask=task-second-order-lead-pid`
- **AND** it MUST include a preset value derived from the task workspace mode

#### Scenario: Black-box task route
- **WHEN** `getArenaWorkspaceHref` is called for `task-cruise-roll-blackbox-identification`
- **THEN** the returned URL MUST target `/interactive-learning/control-workbench`
- **AND** it MUST include `arenaTask=task-cruise-roll-blackbox-identification`
- **AND** it MUST preserve black-box preset context for the workbench

#### Scenario: MPC task route
- **WHEN** `getArenaWorkspaceHref` is called for a predictive-control Arena task
- **THEN** the returned URL MUST target `/interactive-learning/control-workbench`
- **AND** it MUST preserve predictive-control preset context

### Requirement: Control Odyssey remains on its dedicated route
The Arena workspace routing helper SHALL keep Control Odyssey tasks on `/interactive-learning/control-odyssey`.

#### Scenario: Odyssey object route
- **WHEN** an Arena task uses a Control Odyssey object source
- **THEN** the returned URL MUST target `/interactive-learning/control-odyssey`
- **AND** it MUST include the Arena task id as `arenaTask`

#### Scenario: Odyssey workspace mode route
- **WHEN** an Arena task has `workspaceMode` equal to `control-odyssey`
- **THEN** the returned URL MUST target `/interactive-learning/control-odyssey`
- **AND** it MUST NOT target `/interactive-learning/control-workbench`

### Requirement: Publication and extra route parameters survive routing
Arena routing SHALL preserve publication and caller-provided query parameters when building workbench URLs.

#### Scenario: Publication route
- **WHEN** a challenge detail page builds a workbench URL with `publicationId`
- **THEN** the returned URL MUST include the same `publicationId`
- **AND** it MUST include the correct `arenaTask`

#### Scenario: Extra params route
- **WHEN** the route helper receives extra query parameters
- **THEN** the returned URL MUST preserve those parameters
- **AND** explicit caller params MUST NOT remove the required `arenaTask`

### Requirement: Legacy direct routes remain compatible
The first integration pass SHALL keep legacy workbench routes available for direct access.

#### Scenario: Multi-representation direct route
- **WHEN** a user opens `/interactive-learning/multi-representation-linkage` directly
- **THEN** the route MUST continue to render its legacy page or compatibility experience
- **AND** Arena default task links MUST still prefer `/interactive-learning/control-workbench`
