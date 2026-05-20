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

### Requirement: Cross-domain free explore entry targets comprehensive simulation workbench
The cross-domain exploration catalog SHALL present the unified workbench as “综合仿真工作台” and route its primary free-explore entry to `/interactive-learning/control-workbench`.

#### Scenario: Cross-domain primary entry opens unified workbench
- **WHEN** a student opens `/interactive-learning/cross-domain-exploration`
- **THEN** the primary entry SHALL be named “综合仿真工作台”
- **AND** it SHALL link to `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.

#### Scenario: Arena routing remains on unified workbench
- **WHEN** an Arena task route is built for a supported non-Odyssey workspace
- **THEN** the returned URL SHALL still target `/interactive-learning/control-workbench`
- **AND** it SHALL preserve the `arenaTask` and preset parameters.

#### Scenario: Legacy direct route remains available
- **WHEN** a student opens `/interactive-learning/multi-representation-linkage` directly
- **THEN** the route SHALL remain available as a compatibility surface.

### Requirement: Arena-bound workbench renders challenge context without the legacy shell frame
When the unified control workbench is opened from an Arena challenge, the page SHALL preserve Arena challenge context while removing the legacy workbench shell framing.

#### Scenario: Challenge workbench shows session status first
- **WHEN** a student opens `/interactive-learning/control-workbench` with an `arenaTask` parameter
- **THEN** the workbench SHALL render the session or challenge status at the top of the page
- **AND** the status area SHALL appear before the analysis panels.

#### Scenario: Challenge workbench uses full page width
- **WHEN** a student opens an Arena-bound workbench on a desktop-width viewport
- **THEN** the analysis panel area SHALL use the full available content width
- **AND** it SHALL NOT be nested inside the old titled workbench shell frame.

#### Scenario: Challenge context survives shell removal
- **WHEN** the workbench shell frame is removed for an Arena-bound challenge
- **THEN** the page SHALL still show enough challenge context for the student to identify the active task
- **AND** official submission controls SHALL remain bound to the same `arenaTask` value.
