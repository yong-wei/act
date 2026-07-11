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

### Requirement: Cross-domain exploration excludes duplicate workbench catalog entries
The cross-domain exploration catalog SHALL NOT promote the upgraded multi-representation/classic workbench as a public catalog card when Control Workbench is already exposed as a core student entry.

#### Scenario: Student opens cross-domain exploration
- **WHEN** a student opens `/interactive-learning/cross-domain-exploration`
- **THEN** the catalog SHALL NOT render a hard-coded `综合仿真工作台` or classic four-view workbench card
- **AND** it SHALL render available `FUN_EXPLORATION` resources such as Control Odyssey and Ten Drops where those resources exist.

#### Scenario: Workbench free exploration remains reachable
- **WHEN** a student needs free workbench exploration
- **THEN** the student SHALL use the core Control Workbench entry
- **AND** the Control Workbench free-explore route alias MAY continue to target `/interactive-learning/control-workbench?mode=explore&preset=classic-four-view`.

### Requirement: Arena workspace routing preserves adaptive path context
Arena workspace routing SHALL preserve a valid adaptive path launch context when moving from a concrete challenge to Control Odyssey or the unified control workbench.

#### Scenario: Path-bound challenge opens the unified workbench
- **WHEN** `getArenaWorkspaceHref` builds a supported workbench URL for a path-bound challenge
- **THEN** the URL SHALL retain the Arena task and preset together with normalized path source, goal, path, node, intent, return, and resource-type values
- **AND** path values SHALL not overwrite or discard publication values.

#### Scenario: Path-bound challenge opens Control Odyssey
- **WHEN** the challenge object or workspace mode uses Control Odyssey
- **THEN** the dedicated Odyssey route SHALL receive the same normalized path context and Arena task identity.

### Requirement: Arena workbenches expose governed journey continuation
An Arena-bound workbench opened from an adaptive path SHALL show the shared journey control and enable continuation only from server-owned result state.

#### Scenario: Arena completion is accepted
- **WHEN** a governed Arena submission or policy-allowed preview result is bound to the current path node and the server returns a ready next action
- **THEN** the workbench SHALL enable the named next-node action without requiring an intermediate return to the path center
- **AND** `返回学习路径` SHALL remain available.

#### Scenario: Arena evidence is invalid or incomplete
- **WHEN** the Arena result is invalid, belongs to another task, lacks required simulation evidence, or remains pending
- **THEN** the workbench SHALL not enable the next path node
- **AND** the journey control SHALL show the server-provided blocked, remediation, or synchronization state without exposing hidden evaluation details.

